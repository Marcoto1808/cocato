import { createHmac, timingSafeEqual } from "crypto";

export function verificarWebhookGet(
  mode: string | null,
  token: string | null,
  challenge: string | null
): string | null {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (!verifyToken) {
    throw new Error("WHATSAPP_VERIFY_TOKEN no está configurado.");
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return challenge;
  }

  return null;
}

export function validarFirmaWebhook(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();

  if (!appSecret) {
    console.warn("[whatsapp] WHATSAPP_APP_SECRET no configurado; omitiendo validación de firma.");
    return true;
  }

  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const recibida = signatureHeader.slice("sha256=".length);
  const esperada = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(recibida, "hex"),
      Buffer.from(esperada, "hex")
    );
  } catch {
    return false;
  }
}

export type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>;
        statuses?: unknown[];
      };
    }>;
  }>;
};

export function extraerMensajesTexto(payload: WhatsAppWebhookPayload) {
  const mensajes: Array<{
    from: string;
    waMessageId: string;
    texto: string;
    phoneNumberId?: string;
  }> = [];

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
        });
      }
    }
  }

  return mensajes;
}
