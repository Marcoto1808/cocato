/**
 * Webhook WhatsApp (YCloud + Meta) + OpenAI — Supabase Edge Function
 *
 * URL: https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook
 */
import { obtenerSupabaseAdmin } from "../_shared/supabase-client.ts";
import { ChatbotService } from "../_shared/services/chatbot.service.ts";
import { whatsappProvider } from "../_shared/env.ts";
import type { WhatsAppWebhookPayload } from "../_shared/types.ts";
import {
  extraerMensajesTexto,
  validarFirmaWebhook,
  verificarWebhookGet,
} from "../_shared/whatsapp/webhook.ts";
import {
  esEventoYCloud,
  parseYCloudWebhook,
  validarFirmaYCloud,
} from "../_shared/whatsapp/ycloud-webhook.ts";
import { actualizarEstadoMensajePorWamid } from "../_shared/repositories/message.repository.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  try {
    if (req.method === "GET") {
      if (whatsappProvider() === "ycloud") {
        return jsonResponse({
          status: "ok",
          provider: "ycloud",
          message:
            "YCloud no usa verificación GET. Registra esta URL en la consola de YCloud.",
        });
      }

      const verificacion = verificarWebhookGet(url);
      if (verificacion) return verificacion;
      return jsonResponse({ error: "Verificación fallida." }, 403);
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Método no permitido." }, 405);
    }

    const rawBody = await req.text();
    let payload: unknown;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "JSON inválido." }, 400);
    }

    const db = obtenerSupabaseAdmin();
    const chatbot = new ChatbotService(db);

    if (esEventoYCloud(payload)) {
      const signature = req.headers.get("YCloud-Signature");

      if (!(await validarFirmaYCloud(rawBody, signature))) {
        return jsonResponse({ error: "Firma inválida." }, 401);
      }

      const { inboundMessages, statusUpdates } = parseYCloudWebhook(payload);

      const actualizaciones = [];
      for (const update of statusUpdates) {
        actualizaciones.push(
          await actualizarEstadoMensajePorWamid(db, update)
        );
      }

      if (inboundMessages.length === 0) {
        return jsonResponse({
          status: "ok",
          provider: "ycloud",
          procesados: 0,
          actualizaciones,
          resultados: [],
        });
      }

      const resultado = await chatbot.procesarWebhook(inboundMessages);

      return jsonResponse({
        status: "ok",
        provider: "ycloud",
        ...resultado,
        actualizaciones,
      });
    }

    const signature = req.headers.get("x-hub-signature-256");

    if (!(await validarFirmaWebhook(rawBody, signature))) {
      return jsonResponse({ error: "Firma inválida." }, 401);
    }

    const metaPayload = payload as WhatsAppWebhookPayload;

    if (metaPayload.object !== "whatsapp_business_account") {
      return jsonResponse({ status: "ignored" });
    }

    const mensajes = extraerMensajesTexto(metaPayload);

    if (mensajes.length === 0) {
      return jsonResponse({ status: "ok", procesados: 0, resultados: [] });
    }

    const resultado = await chatbot.procesarWebhook(mensajes);

    return jsonResponse({ status: "ok", provider: "meta", ...resultado });
  } catch (error) {
    console.error("[whatsapp-webhook]", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Error interno.",
      },
      500
    );
  }
});
