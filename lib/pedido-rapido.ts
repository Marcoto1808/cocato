import type { SupabaseClient } from "@supabase/supabase-js";

/** Nombre del cliente placeholder interno para pedidos rápidos. */
export const NOMBRE_CLIENTE_SISTEMA = "Cliente temporal";

export const ETIQUETA_CLIENTE_TEMPORAL = "Cliente temporal";

type ClienteJoin = {
  nombre_negocio: string;
} | null | undefined;

type PedidoConNombre = {
  cliente_nombre_temporal?: string | null;
  clientes?: ClienteJoin | ClienteJoin[] | null;
};

function resolverJoin<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

export function esClienteSistema(cliente: { nombre_negocio: string }): boolean {
  return cliente.nombre_negocio === NOMBRE_CLIENTE_SISTEMA;
}

export function esPedidoRapido(pedido: {
  cliente_nombre_temporal?: string | null;
}): boolean {
  return Boolean(pedido.cliente_nombre_temporal?.trim());
}

export function nombreMostrarPedido(pedido: PedidoConNombre): string {
  const nombreTemporal = pedido.cliente_nombre_temporal?.trim();
  if (nombreTemporal) return nombreTemporal;

  const cliente = resolverJoin(pedido.clientes ?? null);
  return cliente?.nombre_negocio ?? "Cliente sin asignar";
}

export async function obtenerClienteSistemaId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id")
    .eq("nombre_negocio", NOMBRE_CLIENTE_SISTEMA)
    .maybeSingle();

  if (error || !data) return null;
  return data.id;
}

export async function vincularPedidosTemporalesAlCliente(
  supabase: SupabaseClient,
  params: {
    nuevoClienteId: string;
    tipoClienteId: string;
    nombreTemporal: string;
  }
): Promise<{ error: string | null; vinculados: number }> {
  const clienteSistemaId = await obtenerClienteSistemaId(supabase);
  if (!clienteSistemaId) {
    return {
      error: "No se encontró el cliente temporal del sistema.",
      vinculados: 0,
    };
  }

  const nombre = params.nombreTemporal.trim();
  if (!nombre) {
    return { error: "El pedido no tiene nombre temporal.", vinculados: 0 };
  }

  const { data, error } = await supabase
    .from("pedidos")
    .update({
      cliente_id: params.nuevoClienteId,
      tipo_cliente_id: params.tipoClienteId,
      cliente_nombre_temporal: null,
      cliente_telefono_temporal: null,
    })
    .eq("cliente_id", clienteSistemaId)
    .ilike("cliente_nombre_temporal", nombre)
    .select("id");

  if (error) {
    return { error: error.message, vinculados: 0 };
  }

  return { error: null, vinculados: data?.length ?? 0 };
}
