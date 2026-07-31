import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type ListaPrecioResuelta = {
  id: string;
  nombre: string;
};

export async function resolverListaPrecioCliente(
  db: SupabaseClient,
  tipoClienteId: string,
  listaPrecioOverrideId: string | null
): Promise<ListaPrecioResuelta | null> {
  if (listaPrecioOverrideId) {
    const { data, error } = await db
      .from("listas_precio")
      .select("id, nombre")
      .eq("id", listaPrecioOverrideId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as ListaPrecioResuelta | null;
  }

  const { data, error } = await db
    .from("listas_precio")
    .select("id, nombre")
    .eq("tipo_cliente_id", tipoClienteId)
    .eq("es_vigente", true)
    .eq("estado", "publicada")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ListaPrecioResuelta | null;
}

export async function cargarPreciosLista(
  db: SupabaseClient,
  listaPrecioId: string
): Promise<Map<string, number>> {
  const { data, error } = await db
    .from("lista_precio_items")
    .select("producto_id, precio")
    .eq("lista_precio_id", listaPrecioId);

  if (error) throw new Error(error.message);

  const precios = new Map<string, number>();
  for (const item of data ?? []) {
    precios.set(item.producto_id, Number(item.precio));
  }
  return precios;
}

export function precioProductoParaPedido(
  precios: Map<string, number>,
  producto: { id: string; precio_kg: number }
): number {
  if (precios.has(producto.id)) {
    return precios.get(producto.id)!;
  }
  return Number(producto.precio_kg) || 0;
}
