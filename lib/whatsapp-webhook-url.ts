/** URL del webhook en Supabase Edge Functions (handler principal de WhatsApp). */
export function urlWebhookWhatsAppSupabase(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) return null;

  try {
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.replace(".supabase.co", "");
    if (!projectRef) return null;
    return `https://${projectRef}.supabase.co/functions/v1/whatsapp-webhook`;
  } catch {
    return null;
  }
}

/**
 * Handler activo del webhook WhatsApp en Next.js/Vercel.
 * Por defecto "supabase": Vercel no procesa mensajes (evita pedidos duplicados).
 * Usar "vercel" solo si Meta apunta a /api/webhooks/whatsapp.
 */
export function handlerWebhookWhatsApp(): "supabase" | "vercel" {
  const valor = process.env.WHATSAPP_WEBHOOK_HANDLER?.trim().toLowerCase();
  return valor === "vercel" ? "vercel" : "supabase";
}

export function webhookWhatsAppVercelActivo(): boolean {
  return handlerWebhookWhatsApp() === "vercel";
}
