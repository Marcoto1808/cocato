import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizarTelefono } from "../whatsapp/phone.ts";

export async function obtenerOCrearConversacion(
  db: SupabaseClient,
  waPhone: string,
  clienteId: string | null
) {
  const phone = normalizarTelefono(waPhone);

  const { data: existente, error: errorBusqueda } = await db
    .from("whatsapp_conversations")
    .select("id, cliente_id, wa_phone, estado_comercial")
    .eq("wa_phone", phone)
    .maybeSingle();

  if (errorBusqueda) throw new Error(errorBusqueda.message);

  if (existente) {
    if (clienteId && existente.cliente_id !== clienteId) {
      await db
        .from("whatsapp_conversations")
        .update({ cliente_id: clienteId })
        .eq("id", existente.id);
    }
    return existente;
  }

  const { data, error } = await db
    .from("whatsapp_conversations")
    .insert({
      wa_phone: phone,
      cliente_id: clienteId,
      estado: "activa",
      estado_comercial: "NUEVA",
      ultimo_mensaje_en: new Date().toISOString(),
    })
    .select("id, cliente_id, wa_phone, estado_comercial")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear conversación.");
  }

  return data;
}

export async function actualizarUltimoMensajeConversacion(
  db: SupabaseClient,
  conversationId: string
) {
  const { error } = await db
    .from("whatsapp_conversations")
    .update({ ultimo_mensaje_en: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw new Error(error.message);
}

export async function actualizarEstadoComercialConversacion(
  db: SupabaseClient,
  conversationId: string,
  estadoComercial: string
) {
  const { error } = await db
    .from("whatsapp_conversations")
    .update({ estado_comercial: estadoComercial })
    .eq("id", conversationId);

  if (error) throw new Error(error.message);
}
