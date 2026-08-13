import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { carritoVacio, type CarritoConversacion } from "../conversation/cart.ts";
import {
  actualizarDireccionCliente,
  obtenerDireccionCliente,
} from "../repositories/conversation.repository.ts";
import {
  construirConfirmacionNuevaDireccionPedido,
  construirEntregaDireccionGuardada,
  construirEntregaDomicilioExistente,
  construirEntregaRecoger,
  construirSolicitudConfirmarDireccionRegistrada,
  construirSolicitudDireccionEntrega,
  construirSolicitudEntrega,
  esDireccionClienteValida,
  esOpcionConfirmarModificarDireccion,
  esOpcionEntrega,
  MENSAJE_CAMBIO_DIRECCION_REQUIERE_VALIDACION,
  pareceSolicitudCambioDireccion,
} from "../conversation/states.ts";
import type { ClienteResuelto } from "../types.ts";
import type { ResultadoTurnoConversacion } from "./conversation-turn.types.ts";
import { registrarAlertaComercial } from "./cliente-registro.service.ts";

export class EntregaService {
  constructor(private readonly db: SupabaseClient) {}

  private finalizarEntrega(respuestaEntrega: string): ResultadoTurnoConversacion {
    return {
      respuesta: respuestaEntrega,
      estadoNuevo: "MENU_PRINCIPAL",
      carrito: carritoVacio(),
    };
  }

  async procesarOpcion(input: {
    cliente: ClienteResuelto;
    carrito: CarritoConversacion;
    mensajeRecibido: string;
    menu: string;
  }): Promise<ResultadoTurnoConversacion> {
    const { cliente, carrito, mensajeRecibido, menu } = input;
    const pedidoId = carrito.entrega?.pedidoId;

    if (!pedidoId) {
      return {
        respuesta: menu,
        estadoNuevo: "MENU_PRINCIPAL",
        carrito: carritoVacio(),
      };
    }

    const direccionExistente = await obtenerDireccionCliente(this.db, cliente.id);
    const opcion = esOpcionEntrega(mensajeRecibido);

    if (
      esDireccionClienteValida(direccionExistente) &&
      pareceSolicitudCambioDireccion(mensajeRecibido, direccionExistente!)
    ) {
      await registrarAlertaComercial(this.db, {
        clienteId: cliente.id,
        pedidoId,
        tipo: "cambio_direccion",
        detalle: mensajeRecibido,
      });

      if (opcion === "1") {
        await this.anotarEnPedido(
          pedidoId,
          `Envío a domicilio (dirección registrada): ${direccionExistente}`
        );
        return this.finalizarEntrega(
          [
            MENSAJE_CAMBIO_DIRECCION_REQUIERE_VALIDACION,
            "",
            construirEntregaDomicilioExistente(direccionExistente!),
          ].join("\n")
        );
      }

      return {
        respuesta: MENSAJE_CAMBIO_DIRECCION_REQUIERE_VALIDACION,
        estadoNuevo: "ENTREGA_OPCION",
        carrito,
      };
    }

    if (opcion === "2") {
      await this.anotarEnPedido(pedidoId, "Entrega: cliente pasa a recoger");
      return this.finalizarEntrega(construirEntregaRecoger());
    }

    if (opcion === "1") {
      if (esDireccionClienteValida(direccionExistente)) {
        return {
          respuesta: construirSolicitudConfirmarDireccionRegistrada(
            direccionExistente!
          ),
          estadoNuevo: "ENTREGA_CONFIRMAR_DIRECCION",
          carrito: {
            ...carrito,
            entrega: { ...carrito.entrega, tipo: "domicilio", pedidoId },
          },
        };
      }

      return {
        respuesta: construirSolicitudDireccionEntrega(),
        estadoNuevo: "ENTREGA_DIRECCION",
        carrito: {
          ...carrito,
          entrega: { ...carrito.entrega, tipo: "domicilio", pedidoId },
        },
      };
    }

    return {
      respuesta: `${construirSolicitudEntrega()}\n\nResponda 1 o 2.`,
      estadoNuevo: "ENTREGA_OPCION",
      carrito,
    };
  }

  async procesarConfirmarDireccion(input: {
    cliente: ClienteResuelto;
    carrito: CarritoConversacion;
    mensajeRecibido: string;
    menu: string;
  }): Promise<ResultadoTurnoConversacion> {
    const { cliente, carrito, mensajeRecibido, menu } = input;
    const pedidoId = carrito.entrega?.pedidoId;
    const direccionExistente = await obtenerDireccionCliente(this.db, cliente.id);
    const opcion = esOpcionConfirmarModificarDireccion(mensajeRecibido);

    if (!pedidoId || !esDireccionClienteValida(direccionExistente)) {
      return {
        respuesta: menu,
        estadoNuevo: "MENU_PRINCIPAL",
        carrito: carritoVacio(),
      };
    }

    if (opcion === "1") {
      await this.anotarEnPedido(
        pedidoId,
        `Envío a domicilio: ${direccionExistente}`
      );
      return this.finalizarEntrega(
        construirEntregaDomicilioExistente(direccionExistente!)
      );
    }

    if (opcion === "2") {
      return {
        respuesta: construirSolicitudDireccionEntrega(),
        estadoNuevo: "ENTREGA_DIRECCION",
        carrito: {
          ...carrito,
          entrega: {
            ...carrito.entrega,
            tipo: "domicilio",
            pedidoId,
            modificandoDireccion: true,
            direccionPendiente: undefined,
          },
        },
      };
    }

    return {
      respuesta: [
        "Opción no válida.",
        "",
        construirSolicitudConfirmarDireccionRegistrada(direccionExistente!),
      ].join("\n"),
      estadoNuevo: "ENTREGA_CONFIRMAR_DIRECCION",
      carrito,
    };
  }

  async procesarDireccion(input: {
    cliente: ClienteResuelto;
    carrito: CarritoConversacion;
    mensajeRecibido: string;
    menu: string;
  }): Promise<ResultadoTurnoConversacion> {
    const { cliente, carrito, mensajeRecibido, menu } = input;
    const pedidoId = carrito.entrega?.pedidoId;
    const direccion = mensajeRecibido.trim();

    if (!pedidoId) {
      return {
        respuesta: menu,
        estadoNuevo: "MENU_PRINCIPAL",
        carrito: carritoVacio(),
      };
    }

    if (direccion.length < 10) {
      return {
        respuesta: `La dirección parece incompleta.\n\n${construirSolicitudDireccionEntrega()}`,
        estadoNuevo: "ENTREGA_DIRECCION",
        carrito,
      };
    }

    if (carrito.entrega?.modificandoDireccion) {
      return {
        respuesta: construirConfirmacionNuevaDireccionPedido(direccion),
        estadoNuevo: "ENTREGA_CONFIRMAR_NUEVA_DIRECCION",
        carrito: {
          ...carrito,
          entrega: {
            ...carrito.entrega,
            tipo: "domicilio",
            pedidoId,
            modificandoDireccion: true,
            direccionPendiente: direccion,
          },
        },
      };
    }

    await actualizarDireccionCliente(this.db, cliente.id, direccion);
    await this.anotarEnPedido(
      pedidoId,
      `Envío a domicilio (dirección registrada): ${direccion}`
    );

    return this.finalizarEntrega(construirEntregaDireccionGuardada(direccion));
  }

  async procesarConfirmarNuevaDireccion(input: {
    cliente: ClienteResuelto;
    carrito: CarritoConversacion;
    mensajeRecibido: string;
    menu: string;
  }): Promise<ResultadoTurnoConversacion> {
    const { cliente, carrito, mensajeRecibido, menu } = input;
    const pedidoId = carrito.entrega?.pedidoId;
    const direccion = carrito.entrega?.direccionPendiente?.trim();
    const opcion = esOpcionConfirmarModificarDireccion(mensajeRecibido);

    if (!pedidoId || !direccion) {
      return {
        respuesta: menu,
        estadoNuevo: "MENU_PRINCIPAL",
        carrito: carritoVacio(),
      };
    }

    if (opcion === "1") {
      await actualizarDireccionCliente(this.db, cliente.id, direccion);
      await this.anotarEnPedido(
        pedidoId,
        `Envío a domicilio: ${direccion}`
      );
      return this.finalizarEntrega(
        construirEntregaDomicilioExistente(direccion)
      );
    }

    if (opcion === "2") {
      return {
        respuesta: construirSolicitudDireccionEntrega(),
        estadoNuevo: "ENTREGA_DIRECCION",
        carrito: {
          ...carrito,
          entrega: {
            ...carrito.entrega,
            tipo: "domicilio",
            pedidoId,
            modificandoDireccion: true,
            direccionPendiente: undefined,
          },
        },
      };
    }

    return {
      respuesta: [
        "Opción no válida.",
        "",
        construirConfirmacionNuevaDireccionPedido(direccion),
      ].join("\n"),
      estadoNuevo: "ENTREGA_CONFIRMAR_NUEVA_DIRECCION",
      carrito,
    };
  }

  private async anotarEnPedido(pedidoId: string, nota: string): Promise<void> {
    const { data: pedido } = await this.db
      .from("pedidos")
      .select("observaciones")
      .eq("id", pedidoId)
      .maybeSingle();

    const previas = (pedido?.observaciones as string | null) ?? "";
    const observaciones = previas ? `${previas}\n${nota}` : nota;

    const { error } = await this.db
      .from("pedidos")
      .update({ observaciones })
      .eq("id", pedidoId);

    if (error) throw new Error(error.message);
  }
}
