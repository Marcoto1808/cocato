import { supabase } from "@/lib/supabase";

export type ListaPrecioResuelta = {
  id: string;
  nombre: string;
  esOverride: boolean;
  balanceId: string | null;
  publicadaEn: string | null;
};

export type PreciosListaMap = Map<string, number>;

export async function obtenerListaVigentePorTipo(
  tipoClienteId: string
): Promise<ListaPrecioResuelta | null> {
  const { data, error } = await supabase
    .from("listas_precio")
    .select("id, nombre, balance_id, publicada_en")
    .eq("tipo_cliente_id", tipoClienteId)
    .eq("es_vigente", true)
    .eq("estado", "publicada")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    nombre: data.nombre,
    esOverride: false,
    balanceId: data.balance_id,
    publicadaEn: data.publicada_en,
  };
}

/**
 * Resuelve la lista de precios para un pedido nuevo.
 * Prioridad: override del cliente → lista vigente publicada por Balance.
 */
export async function resolverListaPrecioCliente(
  tipoClienteId: string,
  listaPrecioOverrideId: string | null
): Promise<{ lista: ListaPrecioResuelta | null; error: string | null }> {
  if (listaPrecioOverrideId) {
    const { data, error } = await supabase
      .from("listas_precio")
      .select("id, nombre, balance_id, publicada_en")
      .eq("id", listaPrecioOverrideId)
      .maybeSingle();

    if (error) {
      return { lista: null, error: error.message };
    }

    if (!data) {
      return {
        lista: null,
        error: "La lista de precios asignada al cliente no existe.",
      };
    }

    return {
      lista: {
        id: data.id,
        nombre: data.nombre,
        esOverride: true,
        balanceId: data.balance_id,
        publicadaEn: data.publicada_en,
      },
      error: null,
    };
  }

  try {
    const lista = await obtenerListaVigentePorTipo(tipoClienteId);
    return { lista, error: null };
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : "Error al cargar la lista vigente.";
    return { lista: null, error: mensaje };
  }
}

/** Precios oficiales desde lista_precio_items (sin fallback al catálogo). */
export async function cargarPreciosLista(
  listaPrecioId: string
): Promise<PreciosListaMap> {
  const { data, error } = await supabase
    .from("lista_precio_items")
    .select("producto_id, precio")
    .eq("lista_precio_id", listaPrecioId);

  if (error) {
    throw new Error(error.message);
  }

  const precios = new Map<string, number>();

  for (const item of data ?? []) {
    precios.set(item.producto_id, Number(item.precio));
  }

  return precios;
}

export function precioProductoEnLista(
  precios: PreciosListaMap,
  productoId: string
): number | null {
  if (!precios.has(productoId)) {
    return null;
  }

  return precios.get(productoId)!;
}

/** Precio para pedido: lista vigente → catálogo oficial (puede ser 0). */
export function precioProductoParaPedido(
  precios: PreciosListaMap,
  producto: { id: string; precio_kg?: number | null }
): number {
  if (precios.has(producto.id)) {
    return precios.get(producto.id)!;
  }

  return Number(producto.precio_kg) || 0;
}

export function combinarPreciosConCatalogo(
  preciosLista: PreciosListaMap,
  productos: { id: string; precio_kg?: number | null }[]
): PreciosListaMap {
  const combinados = new Map<string, number>();

  for (const producto of productos) {
    combinados.set(
      producto.id,
      preciosLista.has(producto.id)
        ? preciosLista.get(producto.id)!
        : Number(producto.precio_kg) || 0
    );
  }

  for (const [productoId, precio] of preciosLista) {
    combinados.set(productoId, precio);
  }

  return combinados;
}
