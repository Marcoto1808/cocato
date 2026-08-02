export type WhatsAppInboundMessage = {
  from: string;
  waMessageId: string;
  texto: string;
  phoneNumberId?: string;
  timestamp?: string;
  nombreContacto?: string;
  /** ID del evento YCloud (deduplicación de reintentos). */
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

export type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
};

export type WhatsAppConfig = {
  id: string;
  activo: boolean;
  phone_number_id: string | null;
};

export type ClienteResuelto = {
  id: string;
  nombre_negocio: string;
  whatsapp: string | null;
  telefono: string | null;
  activo: boolean;
  tipo_cliente_id: string;
  lista_precio_id: string | null;
  limite_credito: number;
};

export type MensajeHistorial = {
  role: "user" | "assistant";
  content: string;
};

export type ProcesarMensajeResultado =
  | { estado: "duplicado" }
  | { estado: "integracion_inactiva" }
  | { estado: "numero_no_registrado" }
  | { estado: "cliente_no_participante" }
  | { estado: "respondido"; messageId: string; respuesta: string; pedidoId?: string }
  | { estado: "pedido_creado"; messageId: string; respuesta: string; pedidoId: string }
  | { estado: "error"; error: string; messageId?: string };
