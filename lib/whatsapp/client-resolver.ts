import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizarTelefonoWa,
  telefonosCoinciden,
} from "@/lib/whatsapp/phone-utils";

export type ClienteResuelto = {
  id: string;
  nombre_negocio: string;
  propietario: string | null;
  tipo_cliente_id: string;
  lista_precio_id: string | null;
  limite_credito: number;
  telefono: string | null;
  whatsapp: string | null;
  activo: boolean;
};

export async function resolverClientePorTelefono(
  db: SupabaseClient,
  waPhone: string
): Promise<ClienteResuelto | null> {
  const normalizado = normalizarTelefonoWa(waPhone);
  if (!normalizado) return null;

  const { data, error } = await db
    .from("clientes")
    .select(
      "id, nombre_negocio, propietario, tipo_cliente_id, lista_precio_id, limite_credito, telefono, whatsapp, activo"
    )
    .eq("activo", true);

  if (error) {
    throw new Error(error.message);
  }

  const clientes = (data ?? []) as ClienteResuelto[];

  return (
    clientes.find(
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

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.activo);
}
