import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { MensajeHistorial } from "../types.ts";
import { historialMaxMensajes } from "../env.ts";

export async function mensajeYaExiste(
  db: SupabaseClient,
  waMessageId: string
): Promise<boolean> {
  const { data, error } = await db
    .from("whatsapp_messages")
    .select("id")
    .eq("wa_message_id", waMessageId)
    .maybeSingle();

  if (error) throw new Error(error.message);
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
) {
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
    .select("id")
    .single();

  if (error?.code === "23505") return null;
  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo guardar mensaje entrante.");
  }

  return data as { id: string };
}

export async function guardarMensajeSaliente(
  db: SupabaseClient,
  input: {
    conversationId: string;
    waMessageId?: string | null;
    contenido: string;
    inboundMessageId?: string;
    pedidoId?: string | null;
  }
) {
  const { error } = await db.from("whatsapp_messages").insert({
    conversation_id: input.conversationId,
    wa_message_id: input.waMessageId ?? null,
    direccion: "outbound",
    tipo: "text",
    contenido: input.contenido,
    procesado: true,
  });

  if (error) throw new Error(error.message);

  if (input.inboundMessageId) {
    await db
      .from("whatsapp_messages")
      .update({
        procesado: true,
        error_procesamiento: null,
        pedido_id: input.pedidoId ?? null,
      })
      .eq("id", input.inboundMessageId);
  }
}

export async function marcarMensajeConError(
  db: SupabaseClient,
  messageId: string,
  error: string
) {
  await db
    .from("whatsapp_messages")
    .update({ procesado: true, error_procesamiento: error })
    .eq("id", messageId);
}

export async function cargarHistorialConversacion(
  db: SupabaseClient,
  conversationId: string
): Promise<MensajeHistorial[]> {
  const limite = historialMaxMensajes() * 2;

  const { data, error } = await db
    .from("whatsapp_messages")
    .select("direccion, contenido")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) throw new Error(error.message);

  const filas = (data ?? []).reverse();

  return filas
    .filter((fila) => fila.contenido?.trim())
    .map((fila) => ({
      role: fila.direccion === "inbound" ? "user" as const : "assistant" as const,
      content: fila.contenido!.trim(),
    }));
}
