import { supabase } from "@/lib/supabase";

export type ListaPrecioResuelta = {
  id: string;
  nombre: string;
  esOverride: boolean;
};

export type PreciosListaMap = Map<string, number>;

export async function resolverListaPrecioCliente(
  tipoClienteId: string,
  listaPrecioOverrideId: string | null
): Promise<{ lista: ListaPrecioResuelta | null; error: string | null }> {
  if (listaPrecioOverrideId) {
    const { data, error } = await supabase
      .from("listas_precio")
      .select("id, nombre")
      .eq("id", listaPrecioOverrideId)
      .maybeSingle();

    if (error) {
      return { lista: null, error: error.message };
    }

    if (!data) {
      return { lista: null, error: "La lista de precios asignada al cliente no existe." };
    }

    return {
      lista: { id: data.id, nombre: data.nombre, esOverride: true },
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("listas_precio")
    .select("id, nombre")
    .eq("tipo_cliente_id", tipoClienteId)
    .eq("es_vigente", true)
    .maybeSingle();

  if (error) {
    return { lista: null, error: error.message };
  }

  if (!data) {
    return {
      lista: null,
      error: null,
    };
  }

  return {
    lista: { id: data.id, nombre: data.nombre, esOverride: false },
    error: null,
  };
}

export async function cargarPreciosLista(
  listaPrecioId: string | null,
  productosFallback: { id: string; precio_kg: number }[]
): Promise<PreciosListaMap> {
  const precios = new Map<string, number>();

  for (const producto of productosFallback) {
    precios.set(producto.id, producto.precio_kg);
  }

  if (!listaPrecioId) {
    return precios;
  }

  const { data, error } = await supabase
    .from("lista_precio_items")
    .select("producto_id, precio")
    .eq("lista_precio_id", listaPrecioId);

  if (error || !data) {
    return precios;
  }

  for (const item of data) {
    precios.set(item.producto_id, Number(item.precio));
  }

  return precios;
}

export function precioProductoEnLista(
  precios: PreciosListaMap,
  productoId: string,
  precioReferencia: number
): number {
  return precios.get(productoId) ?? precioReferencia;
}
