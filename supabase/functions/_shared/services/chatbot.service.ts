import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  actualizarUltimoMensajeConversacion,
  obtenerOCrearConversacion,
} from "../repositories/conversation.repository.ts";
import {
  crearAutorizadorWhatsApp,
  clienteIdDesdeAutorizacion,
} from "../conversation/whatsapp-autorizacion.ts";
import {
  guardarMensajeEntrante,
  guardarMensajeSaliente,
  marcarMensajeConError,
  mensajeYaExiste,
} from "../repositories/message.repository.ts";
import { obtenerWhatsAppConfig } from "../repositories/config.repository.ts";
import { procesarConversationEngine } from "./conversation-engine.service.ts";
import type {
  ProcesarMensajeResultado,
  WhatsAppInboundMessage,
} from "../types.ts";
import { enviarMensajeTexto } from "../whatsapp/messenger.ts";

async function responderYGuardar(input: {
  db: SupabaseClient;
  to: string;
  body: string;
  conversationId: string;
  phoneNumberId: string | null;
  inboundMessageId: string;
}): Promise<ProcesarMensajeResultado> {
  console.log(
    JSON.stringify({
      event: "whatsapp_responder_inicio",
      to: input.to,
      conversation_id: input.conversationId,
      inbound_message_id: input.inboundMessageId,
      phone_number_id: input.phoneNumberId,
      respuesta_length: input.body.length,
      respuesta_preview: input.body.slice(0, 80),
    })
  );

  const envio = await enviarMensajeTexto({
    to: input.to,
    body: input.body,
    phoneNumberId: input.phoneNumberId,
  });

  console.log(
    JSON.stringify({
      event: "whatsapp_responder_resultado",
      to: input.to,
      inbound_message_id: input.inboundMessageId,
      ok: envio.ok,
      wa_message_id: envio.ok ? envio.waMessageId ?? null : null,
      error: envio.ok ? null : envio.error,
    })
  );

  if (!envio.ok) {
    await marcarMensajeConError(input.db, input.inboundMessageId, envio.error);
    return {
      estado: "error",
      error: envio.error,
      messageId: input.inboundMessageId,
    };
  }

  await guardarMensajeSaliente(input.db, {
    conversationId: input.conversationId,
    waMessageId: envio.waMessageId,
    contenido: input.body,
    inboundMessageId: input.inboundMessageId,
  });

  return {
    estado: "respondido",
    messageId: input.inboundMessageId,
    respuesta: input.body,
  };
}

export class ChatbotService {
  constructor(private readonly db: SupabaseClient) {}

  async procesarMensajeEntrante(
    mensaje: WhatsAppInboundMessage,
    phoneNumberIdConfig: string | null
  ): Promise<ProcesarMensajeResultado> {
    if (await mensajeYaExiste(this.db, mensaje.waMessageId)) {
      return { estado: "duplicado" };
    }

    const autorizador = crearAutorizadorWhatsApp(this.db);
    const acceso = await autorizador.autorizar(mensaje.from);
    const conversacion = await obtenerOCrearConversacion(
      this.db,
      mensaje.from,
      clienteIdDesdeAutorizacion(acceso)
    );

    const registro = await guardarMensajeEntrante(this.db, {
      conversationId: conversacion.id,
      waMessageId: mensaje.waMessageId,
      contenido: mensaje.texto,
      payloadRaw: mensaje,
    });

    if (!registro) {
      return { estado: "duplicado" };
    }

    await actualizarUltimoMensajeConversacion(this.db, conversacion.id);

    const phoneNumberId =
      phoneNumberIdConfig ?? mensaje.phoneNumberId ?? null;

    try {
      const engine = await procesarConversationEngine({
        db: this.db,
        conversationId: conversacion.id,
        inboundMessageId: registro.id,
        mensajeRecibido: mensaje.texto,
        waTelefono: mensaje.from,
        estadoComercialActual: conversacion.estado_comercial ?? null,
        acceso,
      });

      return await responderYGuardar({
        db: this.db,
        to: mensaje.from,
        body: engine.respuesta,
        conversationId: conversacion.id,
        phoneNumberId,
        inboundMessageId: registro.id,
      });
    } catch (error) {
      const detalle =
        error instanceof Error ? error.message : "Error al procesar mensaje.";

      await marcarMensajeConError(this.db, registro.id, detalle);

      const fallback =
        "Recibimos tu mensaje pero tuvimos un problema al procesarlo. Intenta de nuevo en unos minutos.";

      await responderYGuardar({
        db: this.db,
        to: mensaje.from,
        body: fallback,
        conversationId: conversacion.id,
        phoneNumberId,
        inboundMessageId: registro.id,
      });

      return { estado: "error", error: detalle, messageId: registro.id };
    }
  }

  async procesarWebhook(mensajes: WhatsAppInboundMessage[]) {
    const config = await obtenerWhatsAppConfig(this.db);

    if (!config?.activo) {
      return {
        procesados: 0,
        omitido: "integracion_inactiva" as const,
        resultados: [],
      };
    }

    const resultados: ProcesarMensajeResultado[] = [];

    for (const mensaje of mensajes) {
      const resultado = await this.procesarMensajeEntrante(
        mensaje,
        config.phone_number_id
      );
      resultados.push(resultado);
    }

    return { procesados: resultados.length, resultados };
  }
}
