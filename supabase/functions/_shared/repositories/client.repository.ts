import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { ClienteResuelto } from "../types.ts";
import { normalizarTelefono, telefonosCoinciden } from "../whatsapp/phone.ts";

export async function resolverClientePorTelefono(
  db: SupabaseClient,
  waPhone: string
): Promise<ClienteResuelto | null> {
  const normalizado = normalizarTelefono(waPhone);

  const { data: clientes, error } = await db
    .from("clientes")
    .select(
      "id, nombre_negocio, propietario, whatsapp, telefono, activo, tipo_cliente_id, lista_precio_id, limite_credito"
    )
    .eq("activo", true);

  if (error) throw new Error(error.message);

  return (
    (clientes as ClienteResuelto[] | null)?.find(
      (cliente) =>
        telefonosCoinciden(cliente.whatsapp, normalizado) ||
        telefonosCoinciden(cliente.telefono, normalizado)
    ) ?? null
  );
}

export async function clienteParticipaWhatsApp(
  db: SupabaseClient,
  clienteId: string
): Promise<boolean> {
  const { data, error } = await db
    .from("whatsapp_clientes_participantes")
    .select("activo")
    .eq("cliente_id", clienteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.activo);
}
