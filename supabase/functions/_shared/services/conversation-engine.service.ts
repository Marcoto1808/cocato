import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { EstadoComercialConversacion } from "../conversation/states.ts";
import {
  esEstadoComercialConversacion,
  esSaludo,
  construirMenuPrincipal,
  MENSAJE_CLIENTE_NO_EXISTE,
  nombreParaSaludo,
} from "../conversation/states.ts";
import type {
  MotivoAccesoDenegado,
  ResultadoAutorizacionWhatsApp,
} from "../conversation/whatsapp-autorizacion.ts";
import { registrarLogConversacion } from "../repositories/conversation-log.repository.ts";
import { actualizarEstadoComercialConversacion } from "../repositories/conversation.repository.ts";
import type { ClienteResuelto } from "../types.ts";

export type ConversationEngineInput = {
  db: SupabaseClient;
  conversationId: string;
  inboundMessageId: string;
  mensajeRecibido: string;
  estadoComercialActual: string | null;
  acceso: ResultadoAutorizacionWhatsApp;
};

export type ConversationEngineOutput = {
  respuesta: string;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
};

export function mensajeAccesoDenegado(motivo: MotivoAccesoDenegado): string {
  switch (motivo) {
    case "cliente_no_encontrado":
      return MENSAJE_CLIENTE_NO_EXISTE;
    case "cliente_no_habilitado":
      // Sprint futuro: mensaje específico cuando exista whatsapp_clientes_participantes.
      return MENSAJE_CLIENTE_NO_EXISTE;
  }
}

function resolverEstadoAnterior(
  valor: string | null
): EstadoComercialConversacion {
  if (esEstadoComercialConversacion(valor)) return valor;
  return "NUEVA";
}

function procesarClienteAutorizado(
  mensajeRecibido: string,
  estadoAnterior: EstadoComercialConversacion,
  cliente: ClienteResuelto
): { respuesta: string; estadoNuevo: EstadoComercialConversacion } {
  const nombre = nombreParaSaludo(cliente);
  const menu = construirMenuPrincipal(nombre);

  if (estadoAnterior === "NUEVA") {
    return { respuesta: menu, estadoNuevo: "MENU_PRINCIPAL" };
  }

  // MENU_PRINCIPAL: no reiniciar conversación; volver a mostrar menú.
  if (estadoAnterior === "MENU_PRINCIPAL") {
    if (esSaludo(mensajeRecibido)) {
      return { respuesta: menu, estadoNuevo: "MENU_PRINCIPAL" };
    }
    return { respuesta: menu, estadoNuevo: "MENU_PRINCIPAL" };
  }

  return { respuesta: menu, estadoNuevo: "MENU_PRINCIPAL" };
}

export async function procesarConversationEngine(
  input: ConversationEngineInput
): Promise<ConversationEngineOutput> {
  const estadoAnteriorRaw = input.estadoComercialActual;
  const estadoAnterior = resolverEstadoAnterior(estadoAnteriorRaw);

  if (!input.acceso.permitido) {
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

  const { respuesta, estadoNuevo } = procesarClienteAutorizado(
    input.mensajeRecibido,
    estadoAnterior,
    input.acceso.cliente
  );

  if (estadoNuevo !== estadoAnterior) {
    await actualizarEstadoComercialConversacion(
      input.db,
      input.conversationId,
      estadoNuevo
    );
  }

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
