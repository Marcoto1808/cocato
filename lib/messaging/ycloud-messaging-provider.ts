import {
  enviarMensajeTextoYCloud,
  verificarConexionYCloud,
} from "@/lib/whatsapp/ycloud-webhook";
import type {
  InboundWhatsAppMessage,
  MessagingProvider,
  SendMessageInput,
  SendMessageResult,
  VerifyConnectionResult,
} from "@/lib/messaging/types";

/**
 * Proveedor YCloud (API REST + webhook externo para entrada).
 * La recepción inbound sigue en supabase/functions/whatsapp-webhook.
 */
export class YCloudMessagingProvider implements MessagingProvider {
  readonly id = "ycloud" as const;

  async start(): Promise<void> {
    // YCloud no requiere sesión local; el webhook Edge recibe mensajes.
  }

  async stop(): Promise<void> {
    // No-op
  }

  isReady(): boolean {
    return Boolean(process.env.YCLOUD_API_KEY?.trim());
  }

  async sendTextMessage(input: SendMessageInput): Promise<SendMessageResult> {
    return enviarMensajeTextoYCloud({
      to: input.to,
      body: input.body,
      fromOverride: input.phoneNumberId,
    });
  }

  async verifyConnection(
    phoneNumberId?: string | null
  ): Promise<VerifyConnectionResult> {
    return verificarConexionYCloud(phoneNumberId);
  }

  onInboundMessage(
    _handler: (message: InboundWhatsAppMessage) => void | Promise<void>
  ): void {
    throw new Error(
      "YCloudMessagingProvider no recibe mensajes directamente; usa el webhook."
    );
  }
}
