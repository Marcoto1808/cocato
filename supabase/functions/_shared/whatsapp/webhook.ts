import {
  whatsappAppSecret,
  whatsappVerifyToken,
} from "../env.ts";
import type {
  WhatsAppInboundMessage,
  WhatsAppWebhookPayload,
} from "../types.ts";

export function verificarWebhookGet(url: URL): Response | null {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = whatsappVerifyToken();

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return null;
}

export async function validarFirmaWebhook(
  rawBody: string,
  signatureHeader: string | null
): Promise<boolean> {
  const appSecret = whatsappAppSecret();

  if (!appSecret) {
    console.warn("[whatsapp] APP_SECRET no configurado; se omite validación HMAC.");
    return true;
  }

  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const recibida = signatureHeader.slice("sha256=".length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const firma = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody)
  );

  const esperada = Array.from(new Uint8Array(firma))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return recibida === esperada;
}

export function extraerMensajesTexto(
  payload: WhatsAppWebhookPayload
): WhatsAppInboundMessage[] {
  const mensajes: WhatsAppInboundMessage[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      const phoneNumberId = change.value?.metadata?.phone_number_id;

      for (const message of change.value?.messages ?? []) {
        if (message.type !== "text" || !message.text?.body?.trim()) continue;
        if (!message.from || !message.id) continue;

        mensajes.push({
          from: message.from,
          waMessageId: message.id,
          texto: message.text.body.trim(),
          phoneNumberId,
          timestamp: message.timestamp,
        });
      }
    }
  }

  return mensajes;
}
