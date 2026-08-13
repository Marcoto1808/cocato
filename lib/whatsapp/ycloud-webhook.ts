import { createHmac, timingSafeEqual } from "crypto";
import { canonicalizarWhatsAppFromNegocio } from "@/lib/whatsapp/phone-utils";

export type WhatsAppInboundMessage = {
  from: string;
  waMessageId: string;
  texto: string;
  phoneNumberId?: string;
  timestamp?: string;
  nombreContacto?: string;
  ycloudEventId?: string;
};

export type WhatsAppMessageStatusUpdate = {
  waMessageId: string;
  status: string;
  errorMessage?: string | null;
  ycloudEventId?: string;
  timestamp?: string;
};

export type YCloudWebhookEvent = {
  id: string;
  type: string;
  apiVersion?: string;
  createTime?: string;
  whatsappInboundMessage?: {
    id?: string;
    wamid?: string;
    from?: string;
    to?: string;
    type?: string;
    sendTime?: string;
    text?: { body?: string };
    customerProfile?: { name?: string };
  };
  whatsappMessage?: {
    id?: string;
    wamid?: string;
    status?: string;
    updateTime?: string;
    errorMessage?: string;
    error?: { message?: string };
  };
};

const TOLERANCIA_FIRMA_SEG = 300;

function envOpcional(...nombres: string[]): string | null {
  for (const nombre of nombres) {
    const valor = process.env[nombre]?.trim();
    if (valor) return valor;
  }
  return null;
}

export function whatsappProvider(): "ycloud" | "meta" {
  const explicito = envOpcional("WHATSAPP_PROVIDER")?.toLowerCase();
  if (explicito === "meta" || explicito === "ycloud") return explicito;
  if (envOpcional("YCLOUD_API_KEY")) return "ycloud";
  return "meta";
}

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

export function validarFirmaYCloud(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = envOpcional("YCLOUD_WEBHOOK_SECRET", "WHATSAPP_WEBHOOK_SECRET")?.trim();

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
    console.warn("[ycloud] Timestamp fuera de tolerancia; se validará la firma de todos modos.");
  }

  const esperada = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  const recibida = parsed.signature.toLowerCase();
  const calculada = esperada.toLowerCase();

  if (recibida.length !== calculada.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(recibida, "utf8"),
      Buffer.from(calculada, "utf8")
    );
  } catch {
    return false;
  }
}

function normalizarTelefono(valor: string): string {
  let digits = valor.replace(/\D/g, "");

  if (digits.startsWith("521") && digits.length === 13) {
    digits = `52${digits.slice(3)}`;
  }

  if (digits.length === 10) {
    digits = `52${digits}`;
  }

  return digits;
}

function extraerTextoInbound(
  msg: NonNullable<YCloudWebhookEvent["whatsappInboundMessage"]>
): string | null {
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

export function ycloudApiKey(): string {
  const key = process.env.YCLOUD_API_KEY?.trim();
  if (!key) throw new Error("YCLOUD_API_KEY no está configurado.");
  return key;
}

export function ycloudWhatsAppFrom(override?: string | null): string {
  const from =
    override?.trim() ||
    process.env.YCLOUD_WHATSAPP_FROM?.trim() ||
    process.env.WHATSAPP_PHONE_NUMBER?.trim() ||
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!from) {
    throw new Error(
      "Número WhatsApp del negocio faltante. Configura YCLOUD_WHATSAPP_FROM."
    );
  }

  return canonicalizarWhatsAppFromNegocio(from);
}

function formatoE164(valor: string): string {
  const digits = valor.replace(/\D/g, "");
  return valor.startsWith("+") ? `+${digits}` : `+${digits}`;
}

export async function enviarMensajeTextoYCloud(input: {
  to: string;
  body: string;
  fromOverride?: string | null;
}): Promise<{ ok: true; waMessageId?: string } | { ok: false; error: string }> {
  try {
    const apiKey = ycloudApiKey();
    const from = ycloudWhatsAppFrom(input.fromOverride);
    const to = formatoE164(normalizarTelefono(input.to));

    const response = await fetch(
      "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly",
      {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          type: "text",
          text: { body: input.body },
        }),
      }
    );

    const data = (await response.json()) as {
      id?: string;
      wamid?: string;
      error?: { message?: string };
      message?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        error: data.error?.message ?? data.message ?? `Error HTTP ${response.status}`,
      };
    }

    return { ok: true, waMessageId: data.wamid ?? data.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error al enviar mensaje.",
    };
  }
}

export async function verificarConexionYCloud(
  phoneNumberId?: string | null
): Promise<{ ok: boolean; detalle: string }> {
  try {
    const apiKey = ycloudApiKey();
    const from = ycloudWhatsAppFrom(phoneNumberId);

    const response = await fetch("https://api.ycloud.com/v2/balance", {
      headers: { "X-API-Key": apiKey },
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      return {
        ok: false,
        detalle: data.message ?? `Error HTTP ${response.status}`,
      };
    }

    return { ok: true, detalle: `YCloud conectado (${from})` };
  } catch (error) {
    return {
      ok: false,
      detalle:
        error instanceof Error ? error.message : "No se pudo verificar conexión.",
    };
  }
}
