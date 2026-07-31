import type { SupabaseClient } from "@supabase/supabase-js";

export type WhatsAppConfig = {
  id: string;
  activo: boolean;
  hora_mensaje_automatico: string | null;
  plantilla_mensaje_id: string | null;
  phone_number_id: string | null;
  updated_at: string;
};

export async function obtenerWhatsAppConfig(
  db: SupabaseClient
): Promise<WhatsAppConfig | null> {
  const { data, error } = await db
    .from("whatsapp_config")
    .select(
      "id, activo, hora_mensaje_automatico, plantilla_mensaje_id, phone_number_id, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as WhatsAppConfig | null) ?? null;
}

export async function actualizarWhatsAppConfig(
  db: SupabaseClient,
  cambios: Partial<
    Pick<
      WhatsAppConfig,
      "activo" | "hora_mensaje_automatico" | "plantilla_mensaje_id" | "phone_number_id"
    >
  >
): Promise<WhatsAppConfig> {
  const actual = await obtenerWhatsAppConfig(db);

  if (!actual) {
    const { data, error } = await db
      .from("whatsapp_config")
      .insert({
        activo: cambios.activo ?? false,
        hora_mensaje_automatico: cambios.hora_mensaje_automatico ?? null,
        plantilla_mensaje_id: cambios.plantilla_mensaje_id ?? null,
        phone_number_id: cambios.phone_number_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .select(
        "id, activo, hora_mensaje_automatico, plantilla_mensaje_id, phone_number_id, updated_at"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "No se pudo crear la configuración.");
    }

    return data as WhatsAppConfig;
  }

  const { data, error } = await db
    .from("whatsapp_config")
    .update({
      ...cambios,
      updated_at: new Date().toISOString(),
    })
    .eq("id", actual.id)
    .select(
      "id, activo, hora_mensaje_automatico, plantilla_mensaje_id, phone_number_id, updated_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar la configuración.");
  }

  return data as WhatsAppConfig;
}

export type WhatsAppTemplate = {
  id: string;
  nombre: string;
  meta_template_name: string | null;
  cuerpo: string;
  activo: boolean;
};

export async function listarPlantillasWhatsApp(
  db: SupabaseClient
): Promise<WhatsAppTemplate[]> {
  const { data, error } = await db
    .from("whatsapp_templates")
    .select("id, nombre, meta_template_name, cuerpo, activo")
    .eq("activo", true)
    .order("nombre");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as WhatsAppTemplate[];
}

export async function obtenerPlantillaPorId(
  db: SupabaseClient,
  id: string
): Promise<WhatsAppTemplate | null> {
  const { data, error } = await db
    .from("whatsapp_templates")
    .select("id, nombre, meta_template_name, cuerpo, activo")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as WhatsAppTemplate | null) ?? null;
}

export async function listarParticipantesWhatsApp(db: SupabaseClient) {
  const { data, error } = await db
    .from("whatsapp_clientes_participantes")
    .select(
      "cliente_id, activo, recibe_mensaje_automatico, clientes(id, nombre_negocio, whatsapp, telefono, activo)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function guardarParticipantesWhatsApp(
  db: SupabaseClient,
  participantes: Array<{
    cliente_id: string;
    activo: boolean;
    recibe_mensaje_automatico: boolean;
  }>
) {
  if (participantes.length === 0) {
    return;
  }

  const { error } = await db.from("whatsapp_clientes_participantes").upsert(
    participantes.map((item) => ({
      cliente_id: item.cliente_id,
      activo: item.activo,
      recibe_mensaje_automatico: item.recibe_mensaje_automatico,
    })),
    { onConflict: "cliente_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function eliminarParticipanteWhatsApp(
  db: SupabaseClient,
  clienteId: string
) {
  const { error } = await db
    .from("whatsapp_clientes_participantes")
    .delete()
    .eq("cliente_id", clienteId);

  if (error) {
    throw new Error(error.message);
  }
}
