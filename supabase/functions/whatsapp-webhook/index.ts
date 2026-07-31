/**
 * Webhook WhatsApp Cloud API + OpenAI — Supabase Edge Function
 *
 * URL: https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook
 */
import { obtenerSupabaseAdmin } from "../_shared/supabase-client.ts";
import { ChatbotService } from "../_shared/services/chatbot.service.ts";
import type { WhatsAppWebhookPayload } from "../_shared/types.ts";
import {
  extraerMensajesTexto,
  validarFirmaWebhook,
  verificarWebhookGet,
} from "../_shared/whatsapp/webhook.ts";

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
    // 1–2. Verificación GET de Meta
    if (req.method === "GET") {
      const verificacion = verificarWebhookGet(url);
      if (verificacion) return verificacion;
      return jsonResponse({ error: "Verificación fallida." }, 403);
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Método no permitido." }, 405);
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");

    if (!(await validarFirmaWebhook(rawBody, signature))) {
      return jsonResponse({ error: "Firma inválida." }, 401);
    }

    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;

    if (payload.object !== "whatsapp_business_account") {
      return jsonResponse({ status: "ignored" });
    }

    const mensajes = extraerMensajesTexto(payload);

    if (mensajes.length === 0) {
      return jsonResponse({ status: "ok", procesados: 0, resultados: [] });
    }

    const db = obtenerSupabaseAdmin();
    const chatbot = new ChatbotService(db);
    const resultado = await chatbot.procesarWebhook(mensajes);

    return jsonResponse({ status: "ok", ...resultado });
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
