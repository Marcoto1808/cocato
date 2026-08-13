/** Lee secrets de Supabase Edge Functions con aliases compatibles con DICATO. */

import { canonicalizarWhatsAppFromNegocio } from "./whatsapp/phone.ts";

export function envOpcional(...nombres: string[]): string | null {
  for (const nombre of nombres) {
    const valor = Deno.env.get(nombre)?.trim();
    if (valor) return valor;
  }
  return null;
}

export function envRequerido(...nombres: string[]): string {
  const valor = envOpcional(...nombres);
  if (!valor) {
    throw new Error(
      `Variable de entorno faltante. Configura una de: ${nombres.join(", ")}`
    );
  }
  return valor;
}

export type WhatsAppProvider = "ycloud" | "meta";

export function whatsappProvider(): WhatsAppProvider {
  const explicito = envOpcional("WHATSAPP_PROVIDER")?.toLowerCase();
  if (explicito === "meta" || explicito === "ycloud") {
    return explicito;
  }
  if (envOpcional("YCLOUD_API_KEY")) return "ycloud";
  return "meta";
}

export function ycloudApiKey(): string {
  return envRequerido("YCLOUD_API_KEY");
}

export function ycloudWebhookSecret(): string | null {
  return envOpcional("YCLOUD_WEBHOOK_SECRET", "WHATSAPP_WEBHOOK_SECRET");
}

/** Número del negocio en E.164 (ej. +525635594183). */
export function ycloudWhatsAppFrom(override?: string | null): string {
  const from =
    override?.trim() ||
    envOpcional("YCLOUD_WHATSAPP_FROM", "WHATSAPP_PHONE_NUMBER") ||
    envOpcional("PHONE_NUMBER_ID", "WHATSAPP_PHONE_NUMBER_ID");

  if (!from) {
    throw new Error(
      "Número WhatsApp del negocio faltante. Configura YCLOUD_WHATSAPP_FROM o PHONE_NUMBER_ID."
    );
  }

  return canonicalizarWhatsAppFromNegocio(from);
}

export function whatsappAccessToken(): string {
  return envRequerido("WHATSAPP_TOKEN", "WHATSAPP_ACCESS_TOKEN");
}

export function whatsappPhoneNumberId(override?: string | null): string {
  return (
    override ??
    envRequerido("PHONE_NUMBER_ID", "WHATSAPP_PHONE_NUMBER_ID")
  );
}

export function whatsappVerifyToken(): string {
  return envRequerido("VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN");
}

export function whatsappAppSecret(): string | null {
  return envOpcional("WHATSAPP_APP_SECRET", "APP_SECRET");
}

export function whatsappApiVersion(): string {
  return envOpcional("WHATSAPP_API_VERSION") ?? "v21.0";
}

export function openaiApiKey(): string {
  return envRequerido("OPENAI_API_KEY");
}

export function openaiModel(): string {
  return envOpcional("OPENAI_MODEL") ?? "gpt-4o-mini";
}

export function openaiSystemPrompt(): string {
  return (
    envOpcional("OPENAI_SYSTEM_PROMPT") ??
    `Eres el asistente de pedidos de DICATO, una empresa de carnicería.
Ayudas a clientes registrados a armar pedidos por WhatsApp.
Responde en español, de forma breve y clara.
Si el cliente pide productos, confirma cantidades y productos.
Si no entiendes el pedido, pide que escriba cantidad y nombre del producto (ejemplo: "5 costillas" o "10 kg molida").
No inventes precios ni productos que no existan en el catálogo cuando se te proporcione.
No menciones que eres una IA.`
  );
}

export function historialMaxMensajes(): number {
  const raw = envOpcional("OPENAI_HISTORY_LIMIT");
  const n = raw ? Number(raw) : 12;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 30) : 12;
}
