import type { SupabaseClient } from "@supabase/supabase-js";

export type WhatsAppMessageRecord = {
  id: string;
  conversation_id: string;
  wa_message_id: string | null;
  direccion: "inbound" | "outbound";
  tipo: string;
  contenido: string | null;
  procesado: boolean;
  pedido_id: string | null;
  error_procesamiento: string | null;
};

export async function mensajeYaProcesado(
  db: SupabaseClient,
  waMessageId: string
): Promise<boolean> {
  const { data, error } = await db
    .from("whatsapp_messages")
    .select("id")
    .eq("wa_message_id", waMessageId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function guardarMensajeEntrante(
  db: SupabaseClient,
  input: {
    conversationId: string;
    waMessageId: string;
    contenido: string;
    payloadRaw: unknown;
  }
): Promise<WhatsAppMessageRecord> {
  const { data, error } = await db
    .from("whatsapp_messages")
    .insert({
      conversation_id: input.conversationId,
      wa_message_id: input.waMessageId,
      direccion: "inbound",
      tipo: "text",
      contenido: input.contenido,
      payload_raw: input.payloadRaw,
      procesado: false,
    })
    .select(
      "id, conversation_id, wa_message_id, direccion, tipo, contenido, procesado, pedido_id, error_procesamiento"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo guardar el mensaje.");
  }

  return data as WhatsAppMessageRecord;
}

export async function guardarMensajeSaliente(
  db: SupabaseClient,
  input: {
    conversationId: string;
    waMessageId?: string | null;
    contenido: string;
    payloadRaw?: unknown;
  }
) {
  const { error } = await db.from("whatsapp_messages").insert({
    conversation_id: input.conversationId,
    wa_message_id: input.waMessageId ?? null,
    direccion: "outbound",
    tipo: "text",
    contenido: input.contenido,
    payload_raw: input.payloadRaw ?? null,
    procesado: true,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function marcarMensajeProcesado(
  db: SupabaseClient,
  messageId: string,
  input: {
    pedidoId?: string | null;
    error?: string | null;
  }
) {
  const { error } = await db
    .from("whatsapp_messages")
    .update({
      procesado: true,
      pedido_id: input.pedidoId ?? null,
      error_procesamiento: input.error ?? null,
    })
    .eq("id", messageId);

  if (error) {
    throw new Error(error.message);
  }
}
