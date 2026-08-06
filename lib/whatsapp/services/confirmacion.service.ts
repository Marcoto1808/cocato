import type { SupabaseClient } from "@supabase/supabase-js";
import {
  carritoVacio,
  mensajeOriginalDesdeCarrito,
  type CarritoConversacion,
} from "@/lib/whatsapp/conversation-cart";
import {
  construirResumenCarrito,
  construirSolicitudConfirmacion,
  construirSolicitudEntrega,
  esCancelacion,
  esConfirmacion,
  MENSAJE_PEDIDO_CANCELADO,
  MENSAJE_PEDIDO_CONFIRMADO,
} from "@/lib/whatsapp/conversation-states";
import type { ClienteResuelto } from "@/lib/whatsapp/client-resolver";
import { crearPedidoDesdeMensajeWhatsApp } from "@/lib/whatsapp/pedido-desde-mensaje";
import type { PedidoService } from "@/lib/whatsapp/services/pedido.service";
import type { ResultadoTurnoConversacion } from "@/lib/whatsapp/services/conversation-turn.types";

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

    if (esConfirmacion(mensajeRecibido)) {
      return this.confirmar(cliente, carrito);
    }

    const eliminacion = await this.pedidoService.intentarEliminarDelCarrito(
      carrito,
      mensajeRecibido
    );
    if (eliminacion) {
      if (eliminacion.carrito.lineas.length === 0) {
        return {
          ...eliminacion,
          estadoNuevo: "PEDIDO_EN_CONSTRUCCION",
        };
      }
      return this.preparar(cliente, eliminacion.carrito);
    }

    if (esCancelacion(mensajeRecibido)) {
      return {
        respuesta: `${MENSAJE_PEDIDO_CANCELADO}\n\n${menu}`,
        estadoNuevo: "MENU_PRINCIPAL",
        carrito: carritoVacio(),
      };
    }

    const agregado = await this.pedidoService.agregarTextoAlCarrito(
      cliente,
      carrito,
      mensajeRecibido
    );

    if (agregado.ok) {
      return this.preparar(cliente, agregado.carrito);
    }

    return {
      respuesta: `${agregado.error}\n\n¿Es correcto? Responda *SÍ* para confirmar, *NO* para cancelar, o escriba una modificación al pedido.`,
      estadoNuevo: "ESPERANDO_CONFIRMACION",
      carrito,
    };
  }

  private async confirmar(
    cliente: ClienteResuelto,
    carrito: CarritoConversacion
  ): Promise<ResultadoTurnoConversacion> {
    const mensajeOriginal =
      carrito.mensajeLibre?.trim() || mensajeOriginalDesdeCarrito(carrito.lineas);

    const resultado = await crearPedidoDesdeMensajeWhatsApp(this.db, {
      cliente,
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
