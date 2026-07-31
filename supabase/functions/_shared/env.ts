/** Lee secrets de Supabase Edge Functions con aliases compatibles con DICATO. */

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
