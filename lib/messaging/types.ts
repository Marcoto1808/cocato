export type MessagingProviderId = "ycloud" | "whatsapp-web" | "meta";

export type InboundWhatsAppMessage = {
  /** Teléfono normalizado para autorización y BD (E.164 sin '+'). */
  from: string;
  /** JID completo para responder (@lid o @c.us). */
  replyTo?: string;
  waMessageId: string;
  texto: string;
  timestamp?: string;
  nombreContacto?: string;
};

export type SendMessageInput = {
  to: string;
  body: string;
  phoneNumberId?: string | null;
};

export type SendMessageResult =
  | { ok: true; waMessageId?: string }
  | { ok: false; error: string };

export type VerifyConnectionResult = {
  ok: boolean;
  detalle: string;
};

/**
 * Abstracción del canal de mensajería WhatsApp.
 * YCloud usa webhook + API REST; WhatsApp Web usa sesión QR local.
 */
export interface MessagingProvider {
  readonly id: MessagingProviderId;

  /** Inicializa el proveedor (QR en whatsapp-web; no-op en YCloud). */
  start(): Promise<void>;

  /** Cierra la sesión del proveedor. */
  stop(): Promise<void>;

  /** Indica si el proveedor puede enviar mensajes ahora. */
  isReady(): boolean;

  sendTextMessage(input: SendMessageInput): Promise<SendMessageResult>;

  verifyConnection?(
    phoneNumberId?: string | null
  ): Promise<VerifyConnectionResult>;

  /** Solo proveedores con recepción propia (whatsapp-web). */
  onInboundMessage?(
    handler: (message: InboundWhatsAppMessage) => void | Promise<void>
  ): void;

  onQr?(handler: (qr: string) => void): void;

  onReady?(handler: () => void): void;

  onDisconnected?(handler: (reason: string) => void): void;
}
