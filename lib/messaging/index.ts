import { resolveMessagingChannel } from "@/lib/messaging/resolve-messaging-channel";
import type { MessagingProvider } from "@/lib/messaging/types";
import { WhatsAppWebProvider } from "@/lib/messaging/whatsapp-web-provider";
import { YCloudMessagingProvider } from "@/lib/messaging/ycloud-messaging-provider";

export function crearMessagingProvider(): MessagingProvider {
  const canal = resolveMessagingChannel();

  switch (canal) {
    case "whatsapp-web":
      return new WhatsAppWebProvider();
    case "ycloud":
      return new YCloudMessagingProvider();
    case "meta":
      throw new Error(
        "MetaMessagingProvider no está implementado en lib/messaging; usa outbound-messenger legacy."
      );
    default:
      return new YCloudMessagingProvider();
  }
}

export { resolveMessagingChannel } from "@/lib/messaging/resolve-messaging-channel";
export {
  registrarMessagingProvider,
  obtenerMessagingProviderRegistrado,
  limpiarMessagingProviderRegistrado,
} from "@/lib/messaging/registry";
export type {
  MessagingProvider,
  InboundWhatsAppMessage,
  SendMessageInput,
  SendMessageResult,
  MessagingProviderId,
} from "@/lib/messaging/types";
export { WhatsAppWebProvider } from "@/lib/messaging/whatsapp-web-provider";
export { YCloudMessagingProvider } from "@/lib/messaging/ycloud-messaging-provider";
export { telefonoAJid, jidATelefono } from "@/lib/messaging/phone-jid";
