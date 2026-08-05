import type { MessagingProviderId } from "@/lib/messaging/types";

function envOpcional(valor: string | undefined | null): string | null {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

/**
 * Canal activo de mensajería.
 * MESSAGING_PROVIDER tiene prioridad sobre WHATSAPP_PROVIDER (legacy).
 */
export function resolveMessagingChannel(): MessagingProviderId {
  const explicito = envOpcional(process.env.MESSAGING_PROVIDER)?.toLowerCase();

  if (
    explicito === "whatsapp-web" ||
    explicito === "whatsapp_web" ||
    explicito === "wweb"
  ) {
    return "whatsapp-web";
  }

  if (explicito === "ycloud" || explicito === "meta") {
    return explicito;
  }

  const legacy = envOpcional(process.env.WHATSAPP_PROVIDER)?.toLowerCase();
  if (legacy === "meta") return "meta";
  if (legacy === "ycloud" || envOpcional(process.env.YCLOUD_API_KEY)) {
    return "ycloud";
  }

  return "ycloud";
}
