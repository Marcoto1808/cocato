import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { normalizarNombreProducto } from "@/lib/interpretacion/resolver-producto";

export type ProductoAlias = {
  id: string;
  producto_id: string;
  alias: string;
  created_at?: string;
};

export async function listarAliasesDeProducto(
  productoId: string
): Promise<{ aliases: ProductoAlias[]; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("producto_aliases")
    .select("id, producto_id, alias, created_at")
    .eq("producto_id", productoId)
    .order("alias", { ascending: true });

  if (error) {
    return { aliases: [], error };
  }

  return { aliases: (data ?? []) as ProductoAlias[], error: null };
}

export async function crearAliasProducto(
  productoId: string,
  alias: string
): Promise<{ alias: ProductoAlias | null; error: PostgrestError | null }> {
  const aliasLimpio = alias.trim();
  if (!aliasLimpio) {
    return {
      alias: null,
      error: {
        message: "El alias no puede estar vacío.",
        details: "",
        hint: "",
        code: "VALIDATION",
      } as PostgrestError,
    };
  }

  const { data, error } = await supabase
    .from("producto_aliases")
    .insert({ producto_id: productoId, alias: aliasLimpio })
    .select("id, producto_id, alias, created_at")
    .single();

  if (error || !data) {
    return { alias: null, error };
  }

  return { alias: data as ProductoAlias, error: null };
}

export async function eliminarAliasProducto(
  aliasId: string
): Promise<{ error: PostgrestError | null }> {
  const { error } = await supabase
    .from("producto_aliases")
    .delete()
    .eq("id", aliasId);

  return { error };
}

export function formatearErrorAlias(error: PostgrestError | null): string {
  if (!error) return "Sin respuesta de Supabase.";
  if (error.code === "23505") {
    return "Ese alias ya está registrado para otro producto.";
  }
  return error.message;
}

/** Mapa producto_id → aliases para enriquecer el catálogo de interpretación. */
export async function cargarAliasesPorProductos(
  db: SupabaseClient,
  productoIds: string[]
): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>();
  if (productoIds.length === 0) return mapa;

  const { data, error } = await db
    .from("producto_aliases")
    .select("producto_id, alias")
    .in("producto_id", productoIds);

  if (error) {
    throw new Error(error.message);
  }

  for (const fila of data ?? []) {
    const actuales = mapa.get(fila.producto_id) ?? [];
    actuales.push(fila.alias);
    mapa.set(fila.producto_id, actuales);
  }

  return mapa;
}

export function aliasCoincideConTexto(alias: string, texto: string): boolean {
  return normalizarNombreProducto(alias) === normalizarNombreProducto(texto);
}
