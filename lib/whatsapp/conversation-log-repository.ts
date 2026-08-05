import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversationEngineLogEntry = {
  conversationId: string;
  inboundMessageId?: string;
  mensajeRecibido: string;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  respuestaEnviada: string;
  clienteId?: string | null;
  motivoAccesoDenegado?: string | null;
};

export async function registrarLogConversacion(
  db: SupabaseClient,
  entry: ConversationEngineLogEntry
): Promise<void> {
  const payload = {
    conversation_id: entry.conversationId,
    inbound_message_id: entry.inboundMessageId ?? null,
    mensaje_recibido: entry.mensajeRecibido,
    estado_anterior: entry.estadoAnterior,
    estado_nuevo: entry.estadoNuevo,
    respuesta_enviada: entry.respuestaEnviada,
  };

  console.log(
    JSON.stringify({
      event: "conversation_engine",
      ...payload,
      cliente_id: entry.clienteId ?? null,
      motivo_acceso_denegado: entry.motivoAccesoDenegado ?? null,
    })
  );

  const { error } = await db.from("whatsapp_conversation_logs").insert(payload);

  if (error) {
    console.error("[conversation_engine] error al guardar log:", error.message);
  }
}
