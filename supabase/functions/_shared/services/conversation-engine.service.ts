import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { carritoVacio } from "../conversation/cart.ts";
import {
  construirMenuPrincipal,
  esCancelacion,
  esEstadoComercialConversacion,
  esVolverMenu,
  MENSAJE_CLIENTE_NO_EXISTE,
  MENSAJE_PEDIDO_CANCELADO,
  nombreParaSaludo,
  type EstadoComercialConversacion,
} from "../conversation/states.ts";
import {
  continuarPedidoRecuperado,
  debeOfrecerRecuperacionPedido,
  esComandoNuevoPedido,
  esComandoVerPedido,
  esOpcionRecuperacionPedido,
  iniciarRecuperacionPedido,
  reiniciarPedidoConversacion,
  respuestaRecuperacionInvalida,
  respuestaVerPedido,
} from "../conversation/comandos-pedido.ts";
import type {
  MotivoAccesoDenegado,
  ResultadoAutorizacionWhatsApp,
} from "../conversation/whatsapp-autorizacion.ts";
import {
  actualizarEstadoYCarritoConversacion,
  obtenerCarritoConversacion,
  vincularClienteConversacion,
} from "../repositories/conversation.repository.ts";
import { registrarLogConversacion } from "../repositories/conversation-log.repository.ts";
import type { ClienteResuelto } from "../types.ts";
import { ClienteRegistroService } from "./cliente-registro.service.ts";
import { ConfirmacionService } from "./confirmacion.service.ts";
import type { ResultadoTurnoConversacion } from "./conversation-turn.types.ts";
import { EntregaService } from "./entrega.service.ts";
import { PedidoService } from "./pedido-conversacion.service.ts";

export type ConversationEngineInput = {
  db: SupabaseClient;
  conversationId: string;
  inboundMessageId: string;
  mensajeRecibido: string;
  waTelefono: string;
  estadoComercialActual: string | null;
  ultimoMensajeEnPrevio?: string | null;
  acceso: ResultadoAutorizacionWhatsApp;
};

export type ConversationEngineOutput = {
  respuesta: string;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
};

export function mensajeAccesoDenegado(motivo: MotivoAccesoDenegado): string {
  if (motivo === "cliente_no_habilitado") {
    return MENSAJE_CLIENTE_NO_EXISTE;
  }
  throw new Error(
    `mensajeAccesoDenegado no aplica para motivo "${motivo}". Use el flujo de registro.`
  );
}

function resolverEstadoAnterior(
  valor: string | null
): EstadoComercialConversacion {
  if (esEstadoComercialConversacion(valor)) return valor;
  return "NUEVA";
}

function esFlujoRegistroCliente(
  acceso: ResultadoAutorizacionWhatsApp,
  estadoAnterior: EstadoComercialConversacion
): boolean {
  if (estadoAnterior === "REGISTRO_CLIENTE") return true;
  return !acceso.permitido && acceso.motivo === "cliente_no_encontrado";
}

function esAccesoDenegadoHabilitacion(
  acceso: ResultadoAutorizacionWhatsApp
): acceso is { permitido: false; motivo: "cliente_no_habilitado" } {
  return !acceso.permitido && acceso.motivo === "cliente_no_habilitado";
}

function crearServicios(db: SupabaseClient) {
  const pedidoService = new PedidoService(db);
  return {
    pedidoService,
    confirmacionService: new ConfirmacionService(db, pedidoService),
    entregaService: new EntregaService(db),
    registroService: new ClienteRegistroService(db),
  };
}

async function resolverDelegacionConfirmacion(
  confirmacionService: ConfirmacionService,
  cliente: ClienteResuelto,
  resultado: ResultadoTurnoConversacion
): Promise<ResultadoTurnoConversacion> {
  if (!resultado.delegarConfirmacion) return resultado;
  return confirmacionService.preparar(cliente, resultado.carrito);
}

async function procesarClienteAutorizado(
  db: SupabaseClient,
  mensajeRecibido: string,
  estadoAnterior: EstadoComercialConversacion,
  cliente: ClienteResuelto,
  carritoInicial: ResultadoTurnoConversacion["carrito"],
  ultimoMensajeEnPrevio?: string | null
): Promise<ResultadoTurnoConversacion> {
  const { pedidoService, confirmacionService, entregaService } =
    crearServicios(db);

  const nombre = nombreParaSaludo(cliente);
  const menu = construirMenuPrincipal(nombre);

  if (esComandoNuevoPedido(mensajeRecibido)) {
    return reiniciarPedidoConversacion(menu);
  }

  if (estadoAnterior === "RECUPERACION_PEDIDO") {
    const opcion = esOpcionRecuperacionPedido(mensajeRecibido);
    if (opcion === "nuevo") {
      return reiniciarPedidoConversacion(menu);
    }
    if (opcion === "continuar") {
      const continuado = continuarPedidoRecuperado(carritoInicial);
      if (continuado) return continuado;
    }
    if (esComandoVerPedido(mensajeRecibido) && carritoInicial.recuperacionPedido) {
      return respuestaVerPedido({
        carrito: carritoInicial.recuperacionPedido.carritoGuardado,
        estadoActual: "RECUPERACION_PEDIDO",
      });
    }
    return respuestaRecuperacionInvalida(carritoInicial);
  }

  if (
    debeOfrecerRecuperacionPedido({
      estado: estadoAnterior,
      carrito: carritoInicial,
      ultimoMensajeEn: ultimoMensajeEnPrevio,
    })
  ) {
    return iniciarRecuperacionPedido({
      estado: estadoAnterior,
      carrito: carritoInicial,
    });
  }

  if (esComandoVerPedido(mensajeRecibido)) {
    return respuestaVerPedido({
      carrito: carritoInicial,
      estadoActual: estadoAnterior,
    });
  }

  if (esVolverMenu(mensajeRecibido) || esCancelacion(mensajeRecibido)) {
    return {
      respuesta: esCancelacion(mensajeRecibido)
        ? `${MENSAJE_PEDIDO_CANCELADO}\n\n${menu}`
        : menu,
      estadoNuevo: "MENU_PRINCIPAL",
      carrito: carritoVacio(),
    };
  }

  if (estadoAnterior === "NUEVA") {
    return {
      respuesta: menu,
      estadoNuevo: "MENU_PRINCIPAL",
      carrito: carritoVacio(),
    };
  }

  if (estadoAnterior === "MENU_PRINCIPAL") {
    const resultado = await pedidoService.procesarMenuPrincipal({
      mensajeRecibido,
      cliente,
      carrito: carritoInicial,
      menu,
    });
    return resolverDelegacionConfirmacion(confirmacionService, cliente, resultado);
  }

  if (estadoAnterior === "PEDIDO_GUIADO_ESPECIE") {
    return pedidoService.procesarEspecieGuiada({
      mensajeRecibido,
      cliente,
      carrito: carritoInicial,
    });
  }

  if (estadoAnterior === "PEDIDO_GUIADO_CATEGORIA") {
    return pedidoService.procesarCategoria({
      mensajeRecibido,
      carrito: carritoInicial,
    });
  }

  if (estadoAnterior === "PEDIDO_GUIADO_PRODUCTO") {
    return pedidoService.procesarProducto({
      mensajeRecibido,
      carrito: carritoInicial,
      menu,
    });
  }

  if (estadoAnterior === "PEDIDO_GUIADO_CANTIDAD") {
    return pedidoService.procesarCantidadGuiada({
      mensajeRecibido,
      cliente,
      carrito: carritoInicial,
      menu,
    });
  }

  if (estadoAnterior === "PEDIDO_EN_CONSTRUCCION") {
    const construccion = await pedidoService.procesarConstruccion({
      mensajeRecibido,
      cliente,
      carrito: carritoInicial,
    });

    if (construccion.tipo === "turno") {
      return resolverDelegacionConfirmacion(
        confirmacionService,
        cliente,
        construccion.resultado
      );
    }

    if (construccion.tipo === "confirmar") {
      return confirmacionService.confirmarPedido(
        cliente,
        construccion.carrito
      );
    }

    if (construccion.tipo === "listo_libre") {
      const libre = await pedidoService.finalizarPedidoLibre(
        cliente,
        construccion.carrito
      );
      if (!libre.ok) return libre.resultado;
      return confirmacionService.preparar(cliente, libre.carrito);
    }

    return confirmacionService.preparar(cliente, construccion.carrito);
  }

  if (estadoAnterior === "ESPERANDO_CONFIRMACION") {
    return confirmacionService.procesarTurno({
      mensajeRecibido,
      cliente,
      carrito: carritoInicial,
      menu,
    });
  }

  if (estadoAnterior === "ENTREGA_OPCION") {
    return entregaService.procesarOpcion({
      cliente,
      carrito: carritoInicial,
      mensajeRecibido,
      menu,
    });
  }

  if (estadoAnterior === "ENTREGA_CONFIRMAR_DIRECCION") {
    return entregaService.procesarConfirmarDireccion({
      cliente,
      carrito: carritoInicial,
      mensajeRecibido,
      menu,
    });
  }

  if (estadoAnterior === "ENTREGA_DIRECCION") {
    return entregaService.procesarDireccion({
      cliente,
      carrito: carritoInicial,
      mensajeRecibido,
      menu,
    });
  }

  if (estadoAnterior === "ENTREGA_CONFIRMAR_NUEVA_DIRECCION") {
    return entregaService.procesarConfirmarNuevaDireccion({
      cliente,
      carrito: carritoInicial,
      mensajeRecibido,
      menu,
    });
  }

  return {
    respuesta: menu,
    estadoNuevo: "MENU_PRINCIPAL",
    carrito: carritoVacio(),
  };
}

async function persistirTurno(
  db: SupabaseClient,
  conversationId: string,
  turno: ResultadoTurnoConversacion
): Promise<void> {
  await actualizarEstadoYCarritoConversacion(db, conversationId, {
    estadoComercial: turno.estadoNuevo,
    carrito: turno.carrito,
  });
}

export async function procesarConversationEngine(
  input: ConversationEngineInput
): Promise<ConversationEngineOutput> {
  const estadoAnteriorRaw = input.estadoComercialActual;
  const estadoAnterior = resolverEstadoAnterior(estadoAnteriorRaw);
  const carritoInicial = await obtenerCarritoConversacion(
    input.db,
    input.conversationId
  );

  if (esFlujoRegistroCliente(input.acceso, estadoAnterior)) {
    const registroService = new ClienteRegistroService(input.db);
    const { respuesta, estadoNuevo, carrito, clienteId } =
      await registroService.procesarTurno({
        waTelefono: input.waTelefono,
        mensajeRecibido: input.mensajeRecibido,
        estadoAnterior,
        carrito: carritoInicial,
      });

    if (clienteId) {
      await vincularClienteConversacion(
        input.db,
        input.conversationId,
        clienteId
      );
    }

    await persistirTurno(input.db, input.conversationId, {
      respuesta,
      estadoNuevo,
      carrito,
      clienteId,
    });

    await registrarLogConversacion(input.db, {
      conversationId: input.conversationId,
      inboundMessageId: input.inboundMessageId,
      mensajeRecibido: input.mensajeRecibido,
      estadoAnterior: estadoAnteriorRaw ?? estadoAnterior,
      estadoNuevo,
      respuestaEnviada: respuesta,
      clienteId: clienteId ?? null,
    });

    return {
      respuesta,
      estadoAnterior: estadoAnteriorRaw ?? estadoAnterior,
      estadoNuevo,
    };
  }

  if (esAccesoDenegadoHabilitacion(input.acceso)) {
    const respuesta = mensajeAccesoDenegado(input.acceso.motivo);

    await registrarLogConversacion(input.db, {
      conversationId: input.conversationId,
      inboundMessageId: input.inboundMessageId,
      mensajeRecibido: input.mensajeRecibido,
      estadoAnterior: estadoAnteriorRaw,
      estadoNuevo: estadoAnteriorRaw,
      respuestaEnviada: respuesta,
      clienteId: null,
      motivoAccesoDenegado: input.acceso.motivo,
    });

    return {
      respuesta,
      estadoAnterior: estadoAnteriorRaw,
      estadoNuevo: estadoAnteriorRaw,
    };
  }

  if (!input.acceso.permitido) {
    throw new Error(
      `Acceso no permitido con motivo desconocido: ${String(
        (input.acceso as { motivo?: string }).motivo
      )}`
    );
  }

  const { respuesta, estadoNuevo, carrito } = await procesarClienteAutorizado(
    input.db,
    input.mensajeRecibido,
    estadoAnterior,
    input.acceso.cliente,
    carritoInicial,
    input.ultimoMensajeEnPrevio
  );

  await persistirTurno(input.db, input.conversationId, {
    respuesta,
    estadoNuevo,
    carrito,
  });

  await registrarLogConversacion(input.db, {
    conversationId: input.conversationId,
    inboundMessageId: input.inboundMessageId,
    mensajeRecibido: input.mensajeRecibido,
    estadoAnterior: estadoAnteriorRaw ?? estadoAnterior,
    estadoNuevo,
    respuestaEnviada: respuesta,
    clienteId: input.acceso.cliente.id,
  });

  return {
    respuesta,
    estadoAnterior: estadoAnteriorRaw ?? estadoAnterior,
    estadoNuevo,
  };
}
