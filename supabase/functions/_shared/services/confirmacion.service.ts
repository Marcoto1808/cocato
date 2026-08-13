import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  carritoVacio,
  mensajeOriginalDesdeCarrito,
  type CarritoConversacion,
} from "../conversation/cart.ts";
import {
  construirInstruccionAgregarMas,
  construirResumenCarrito,
  construirRespuestaConfirmacionInvalida,
  construirSolicitudConfirmacion,
  construirSolicitudEntrega,
  carritoTieneInformacionPendiente,
  MENSAJE_PEDIDO_CONFIRMADO,
} from "../conversation/states.ts";
import {
  esOpcionConfirmacionPedido,
  reiniciarPedidoConversacion,
} from "../conversation/comandos-pedido.ts";
import { esTextoLibreProductoPedido } from "../conversation/pedido-guiado-productos.ts";
import type { ClienteResuelto } from "../types.ts";
import type { ResultadoTurnoConversacion } from "./conversation-turn.types.ts";
import { PedidoService } from "./pedido-conversacion.service.ts";
import { crearPedidoDesdeCarritoWhatsApp } from "./pedido-desde-mensaje.service.ts";

export class ConfirmacionService {
  constructor(
    private readonly db: SupabaseClient,
    private readonly pedidoService: PedidoService
  ) {}

  async preparar(
    cliente: ClienteResuelto,
    carrito: CarritoConversacion
  ): Promise<ResultadoTurnoConversacion> {
    if (carrito.lineas.length === 0) {
      return {
        respuesta:
          "Su pedido está vacío. Escriba productos o elija *2* para pedido guiado.",
        estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
        carrito,
      };
    }

    if (carritoTieneInformacionPendiente(carrito)) {
      return this.pedidoService.responderInformacionPendiente(carrito);
    }

    const total = await this.pedidoService.calcularTotal(cliente, carrito.lineas);
    const resumen = construirResumenCarrito(carrito.lineas, carrito.observaciones);

    return {
      respuesta: construirSolicitudConfirmacion(resumen),
      estadoNuevo: "ESPERANDO_CONFIRMACION",
      carrito: { ...carrito, totalEstimado: total ?? undefined },
    };
  }

  async procesarTurno(input: {
    mensajeRecibido: string;
    cliente: ClienteResuelto;
    carrito: CarritoConversacion;
    menu: string;
  }): Promise<ResultadoTurnoConversacion> {
    const { mensajeRecibido, cliente, carrito, menu } = input;

    if (carrito.contextoDisambiguacion) {
      const resuelto = await this.pedidoService.procesarDisambiguacionPendiente(
        cliente,
        carrito,
        mensajeRecibido
      );
      if (resuelto.delegarConfirmacion) {
        return this.preparar(cliente, resuelto.carrito);
      }
      return resuelto;
    }

    if (esTextoLibreProductoPedido(mensajeRecibido)) {
      const agregado = await this.pedidoService.agregarTextoAlCarrito(
        cliente,
        carrito,
        mensajeRecibido
      );

      if (agregado.ok) {
        return this.preparar(cliente, agregado.carrito);
      }

      const resumen = construirResumenCarrito(
        carrito.lineas,
        carrito.observaciones
      );

      return {
        respuesta: `${agregado.error}\n\n${construirSolicitudConfirmacion(resumen)}`,
        estadoNuevo: "ESPERANDO_CONFIRMACION",
        carrito,
      };
    }

    const opcion = esOpcionConfirmacionPedido(mensajeRecibido);

    if (opcion === "confirmar") {
      if (carritoTieneInformacionPendiente(carrito)) {
        return this.pedidoService.responderInformacionPendiente(carrito);
      }
      return this.confirmar(cliente, carrito);
    }

    if (opcion === "reiniciar") {
      return reiniciarPedidoConversacion(menu);
    }

    if (opcion === "seguir") {
      return {
        respuesta: construirInstruccionAgregarMas(),
        estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
        carrito: {
          ...carrito,
          totalEstimado: undefined,
          modo: "libre",
          contextoGuiado: null,
          contextoDisambiguacion: null,
        },
      };
    }

    return {
      respuesta: construirRespuestaConfirmacionInvalida(),
      estadoNuevo: "ESPERANDO_CONFIRMACION",
      carrito,
    };
  }

  async confirmarPedido(
    cliente: ClienteResuelto,
    carrito: CarritoConversacion
  ): Promise<ResultadoTurnoConversacion> {
    return this.confirmar(cliente, carrito);
  }

  private async confirmar(
    cliente: ClienteResuelto,
    carrito: CarritoConversacion
  ): Promise<ResultadoTurnoConversacion> {
    const mensajeOriginal =
      carrito.mensajeLibre?.trim() || mensajeOriginalDesdeCarrito(carrito.lineas);

    const resultado = await crearPedidoDesdeCarritoWhatsApp(this.db, {
      cliente,
      lineas: carrito.lineas,
      mensajeOriginal,
      listaPrecioId: cliente.lista_precio_id,
    });

    if (!resultado.ok) {
      return {
        respuesta: `No pudimos confirmar su pedido: ${resultado.error}`,
        estadoNuevo: "ESPERANDO_CONFIRMACION",
        carrito,
      };
    }

    return {
      respuesta: [
        MENSAJE_PEDIDO_CONFIRMADO,
        `Folio: ${resultado.pedidoId}`,
        "",
        construirSolicitudEntrega(),
      ].join("\n"),
      estadoNuevo: "ENTREGA_OPCION",
      carrito: {
        ...carritoVacio(),
        entrega: { pedidoId: resultado.pedidoId },
      },
    };
  }
}
