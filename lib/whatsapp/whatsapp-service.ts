import type { SupabaseClient } from "@supabase/supabase-js";
import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";
import {
  crearAutorizadorWhatsApp,
  clienteIdDesdeAutorizacion,
} from "@/lib/whatsapp/whatsapp-autorizacion";
import {
  obtenerOCrearConversacion,
  actualizarUltimoMensajeConversacion,
} from "@/lib/whatsapp/conversation-repository";
import { procesarConversationEngine } from "@/lib/whatsapp/conversation-engine";
import {
  guardarMensajeEntrante,
  guardarMensajeSaliente,
  marcarMensajeProcesado,
  mensajeYaProcesado,
} from "@/lib/whatsapp/message-repository";
import { enviarMensajeTextoWhatsApp } from "@/lib/whatsapp/outbound-messenger";
import { obtenerWhatsAppConfig } from "@/lib/whatsapp/config-repository";
import type { WhatsAppWebhookPayload } from "@/lib/whatsapp/webhook-validator";
import { extraerMensajesTexto } from "@/lib/whatsapp/webhook-validator";

export class WhatsAppService {
  private db: SupabaseClient | null = null;

  private obtenerDb(): SupabaseClient {
    if (!this.db) {
      this.db = obtenerSupabaseAdmin();
    }
    return this.db;
  }

  async procesarWebhook(payload: WhatsAppWebhookPayload) {
    const db = this.obtenerDb();
    const config = await obtenerWhatsAppConfig(db);

    if (!config?.activo) {
      return { procesados: 0, omitido: "integracion_inactiva" };
    }

    const mensajes = extraerMensajesTexto(payload);
    let procesados = 0;

    for (const mensaje of mensajes) {
      const yaExiste = await mensajeYaProcesado(db, mensaje.waMessageId);
      if (yaExiste) continue;

      await this.procesarMensajeEntrante({
        from: mensaje.from,
        waMessageId: mensaje.waMessageId,
        texto: mensaje.texto,
        phoneNumberId: config.phone_number_id ?? mensaje.phoneNumberId ?? null,
      });

      procesados += 1;
    }

    return { procesados };
  }

  async procesarMensajeEntrante(input: {
    from: string;
    waMessageId: string;
    texto: string;
    phoneNumberId: string | null;
  }) {
    const db = this.obtenerDb();
    const config = await obtenerWhatsAppConfig(db);
    const phoneNumberId = input.phoneNumberId ?? config?.phone_number_id ?? null;

    const autorizador = crearAutorizadorWhatsApp(db);
    const acceso = await autorizador.autorizar(input.from);
    const conversacion = await obtenerOCrearConversacion(
      db,
      input.from,
      clienteIdDesdeAutorizacion(acceso)
    );

    const registro = await guardarMensajeEntrante(db, {
      conversationId: conversacion.id,
      waMessageId: input.waMessageId,
      contenido: input.texto,
      payloadRaw: input,
    });

    await actualizarUltimoMensajeConversacion(db, conversacion.id);

    const engine = await procesarConversationEngine({
      db,
      conversationId: conversacion.id,
      inboundMessageId: registro.id,
      mensajeRecibido: input.texto,
      estadoComercialActual: conversacion.estado_comercial ?? null,
      acceso,
    });

    await this.responderTexto({
      to: input.from,
      body: engine.respuesta,
      conversationId: conversacion.id,
      phoneNumberId,
    });

    await marcarMensajeProcesado(db, registro.id, {});

    return {
      estado: "respondido" as const,
      estadoAnterior: engine.estadoAnterior,
      estadoNuevo: engine.estadoNuevo,
    };
  }

  async enviarMensaje(input: {
    to: string;
    body: string;
    phoneNumberId?: string | null;
  }) {
    const db = this.obtenerDb();
    const config = await obtenerWhatsAppConfig(db);
    const phoneNumberId =
      input.phoneNumberId ?? config?.phone_number_id ?? null;

    const autorizador = crearAutorizadorWhatsApp(db);
    const acceso = await autorizador.autorizar(input.to);
    const conversacion = await obtenerOCrearConversacion(
      db,
      input.to,
      clienteIdDesdeAutorizacion(acceso)
    );

    return this.responderTexto({
      to: input.to,
      body: input.body,
      conversationId: conversacion.id,
      phoneNumberId,
    });
  }

  private async responderTexto(input: {
    to: string;
    body: string;
    conversationId: string;
    phoneNumberId: string | null;
  }) {
    const db = this.obtenerDb();
    const resultado = await enviarMensajeTextoWhatsApp({
      to: input.to,
      body: input.body,
      phoneNumberId: input.phoneNumberId,
    });

    if (resultado.ok) {
      await guardarMensajeSaliente(db, {
        conversationId: input.conversationId,
        waMessageId: resultado.waMessageId,
        contenido: input.body,
      });
    }

    return resultado;
  }
}

let instanciaWhatsApp: WhatsAppService | null = null;

export function obtenerWhatsAppService(): WhatsAppService {
  if (!instanciaWhatsApp) {
    instanciaWhatsApp = new WhatsAppService();
  }
  return instanciaWhatsApp;
}
