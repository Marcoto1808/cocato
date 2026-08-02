import type {
  WhatsAppInboundMessage,
  WhatsAppMessageStatusUpdate,
  YCloudWebhookEvent,
} from "../types.ts";
import { ycloudWebhookSecret } from "../env.ts";
import { normalizarTelefono } from "./phone.ts";

const TOLERANCIA_FIRMA_SEG = 300;
const textEncoder = new TextEncoder();

function parseYCloudSignature(header: string): { timestamp: string; signature: string } | null {
  const partes = header.split(",").map((p) => p.trim());
  let timestamp: string | null = null;
  let signature: string | null = null;

  for (const parte of partes) {
    if (parte.startsWith("t=")) timestamp = parte.slice(2);
    if (parte.startsWith("s=")) signature = parte.slice(2);
  }

  if (!timestamp || !signature) return null;
  return { timestamp, signature };
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(message)
  );

  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function equalHex(a: string, b: string): boolean {
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  if (aa.length !== bb.length) return false;

  let diff = 0;
  for (let i = 0; i < aa.length; i++) {
    diff |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return diff === 0;
}

export async function validarFirmaYCloud(
  rawBody: string,
  signatureHeader: string | null
): Promise<boolean> {
  const secret = ycloudWebhookSecret()?.trim();

  if (!secret) {
    console.warn("[ycloud] YCLOUD_WEBHOOK_SECRET no configurado; omitiendo validación de firma.");
    return true;
  }

  if (!signatureHeader) return false;

  const parsed = parseYCloudSignature(signatureHeader);
  if (!parsed) return false;

  const ts = Number(parsed.timestamp);
  if (!Number.isFinite(ts)) return false;

  const ahora = Math.floor(Date.now() / 1000);
  if (Math.abs(ahora - ts) > TOLERANCIA_FIRMA_SEG) {
    console.warn(
      "[ycloud] Timestamp fuera de tolerancia; se validará la firma de todos modos.",
      { ts, ahora, delta: Math.abs(ahora - ts) }
    );
  }

  const candidatos = [rawBody];
  try {
    const normalizado = JSON.stringify(JSON.parse(rawBody));
    if (normalizado !== rawBody) candidatos.push(normalizado);
  } catch {
    // body no JSON
  }

  for (const cuerpo of candidatos) {
    const calculada = await hmacSha256Hex(
      secret,
      `${parsed.timestamp}.${cuerpo}`
    );

    if (equalHex(parsed.signature, calculada)) {
      return true;
    }
  }

  return false;
}

function extraerTextoInbound(msg: NonNullable<YCloudWebhookEvent["whatsappInboundMessage"]>): string | null {
  if (msg.type !== "text") return null;
  const body = msg.text?.body?.trim();
  return body || null;
}

export function parseYCloudWebhook(event: YCloudWebhookEvent): {
  inboundMessages: WhatsAppInboundMessage[];
  statusUpdates: WhatsAppMessageStatusUpdate[];
} {
  const inboundMessages: WhatsAppInboundMessage[] = [];
  const statusUpdates: WhatsAppMessageStatusUpdate[] = [];

  if (event.type === "whatsapp.inbound_message.received" && event.whatsappInboundMessage) {
    const msg = event.whatsappInboundMessage;
    const texto = extraerTextoInbound(msg);

    if (texto && msg.from) {
      const waMessageId = msg.wamid?.trim() || msg.id?.trim();
      if (waMessageId) {
        inboundMessages.push({
          from: normalizarTelefono(msg.from),
          waMessageId,
          texto,
          phoneNumberId: msg.to ? normalizarTelefono(msg.to) : undefined,
          timestamp: msg.sendTime ?? event.createTime,
          nombreContacto: msg.customerProfile?.name,
          ycloudEventId: event.id,
        });
      }
    }
  }

  if (event.type === "whatsapp.message.updated" && event.whatsappMessage) {
    const msg = event.whatsappMessage;
    const waMessageId = msg.wamid?.trim() || msg.id?.trim();

    if (waMessageId && msg.status) {
      statusUpdates.push({
        waMessageId,
        status: msg.status,
        errorMessage: msg.errorMessage ?? msg.error?.message ?? null,
        ycloudEventId: event.id,
        timestamp: msg.updateTime ?? event.createTime,
      });
    }
  }

  return { inboundMessages, statusUpdates };
}

export function esEventoYCloud(payload: unknown): payload is YCloudWebhookEvent {
  if (!payload || typeof payload !== "object") return false;
  const tipo = (payload as { type?: string }).type;
  return (
    typeof tipo === "string" &&
    (tipo === "whatsapp.inbound_message.received" ||
      tipo === "whatsapp.message.updated" ||
      tipo.startsWith("whatsapp."))
  );
}
