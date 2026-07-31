import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { WhatsAppConfig } from "../types.ts";

export async function obtenerWhatsAppConfig(
  db: SupabaseClient
): Promise<WhatsAppConfig | null> {
  const { data, error } = await db
    .from("whatsapp_config")
    .select("id, activo, phone_number_id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as WhatsAppConfig | null;
}

export async function listarProductosActivos(db: SupabaseClient, limite = 80) {
  const { data, error } = await db
    .from("productos")
    .select("nombre, categoria, unidad")
    .eq("activo", true)
    .order("nombre")
    .limit(limite);

  if (error) throw new Error(error.message);
  return data ?? [];
}
