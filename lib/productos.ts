import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  esTipoCalculoProducto,
  tipoCalculoPorDefecto,
  type TipoCalculoProducto,
} from "@/lib/tipo-calculo-producto";

export const CATEGORIAS_PRODUCTO = ["Res", "Cerdo"] as const;
export const SUBCATEGORIAS_PRODUCTO = [
  "Corte",
  "Embutido",
  "Vísceras",
  "Huesos",
  "Grasa",
  "Obrador",
] as const;
export const UNIDADES_PRODUCTO = ["kg", "pieza", "paquete", "caja"] as const;

export type CategoriaProducto = (typeof CATEGORIAS_PRODUCTO)[number];
export type SubcategoriaProducto = (typeof SUBCATEGORIAS_PRODUCTO)[number];
export type UnidadProducto = (typeof UNIDADES_PRODUCTO)[number];

/** Columnas alineadas con public.productos en sql/schema_cocato.sql */
export const COLUMNAS_PRODUCTO =
  "id, nombre, precio_kg, unidad, categoria, subcategoria, tipo_calculo, codigo_balance, activo, orden";

export type Producto = {
  id: string;
  nombre: string;
  precio_kg: number;
  unidad: string;
  categoria: string;
  subcategoria: string;
  tipo_calculo: TipoCalculoProducto;
  codigo_balance: string | null;
  activo: boolean;
  orden: number;
};

export type ProductoInput = {
  nombre: string;
  precio_kg: number;
  unidad: string;
  categoria: string;
  subcategoria: string;
  tipo_calculo: TipoCalculoProducto;
  codigo_balance?: string | null;
  activo: boolean;
};

export type FiltrosProductos = {
  busqueda?: string;
  categoria?: string;
};

type ProductoDb = Omit<Producto, "tipo_calculo"> & {
  tipo_calculo?: string | null;
};

function esDuplicado(error: PostgrestError | null): boolean {
  return error?.code === "23505";
}

function normalizarProducto(producto: ProductoDb): Producto {
  return {
    ...producto,
    codigo_balance: producto.codigo_balance ?? null,
    orden: producto.orden ?? 0,
    tipo_calculo:
      producto.tipo_calculo && esTipoCalculoProducto(producto.tipo_calculo)
        ? producto.tipo_calculo
        : tipoCalculoPorDefecto(producto.unidad),
  };
}

export function formatearErrorProducto(error: PostgrestError | null): string {
  if (!error) {
    return "Sin respuesta de Supabase.";
  }

  if (esDuplicado(error)) {
    return "Ya existe un producto con ese nombre en la categoría seleccionada.";
  }

  return [
    error.message,
    error.details ? `Detalle: ${error.details}` : null,
    error.hint ? `Hint: ${error.hint}` : null,
    error.code ? `Código: ${error.code}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function buildQuery(filtros: FiltrosProductos) {
  let query = supabase
    .from("productos")
    .select(COLUMNAS_PRODUCTO)
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  const categoria = filtros.categoria?.trim();
  if (categoria && categoria !== "Todas") {
    query = query.eq("categoria", categoria);
  }

  const busqueda = filtros.busqueda?.trim();
  if (busqueda) {
    query = query.ilike("nombre", `%${busqueda}%`);
  }

  return query;
}

function payloadDesdeInput(input: ProductoInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    nombre: input.nombre,
    precio_kg: input.precio_kg,
    unidad: input.unidad,
    categoria: input.categoria,
    subcategoria: input.subcategoria,
    tipo_calculo: input.tipo_calculo,
    activo: input.activo,
  };

  if (input.codigo_balance !== undefined) {
    payload.codigo_balance = input.codigo_balance || null;
  }

  return payload;
}

export async function contarProductos(): Promise<{
  total: number;
  activos: number;
  inactivos: number;
  error: PostgrestError | null;
}> {
  const [totalRes, activosRes] = await Promise.all([
    supabase.from("productos").select("id", { count: "exact", head: true }),
    supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("activo", true),
  ]);

  const error = totalRes.error ?? activosRes.error ?? null;
  if (error) {
    return { total: 0, activos: 0, inactivos: 0, error };
  }

  const total = totalRes.count ?? 0;
  const activos = activosRes.count ?? 0;

  return {
    total,
    activos,
    inactivos: total - activos,
    error: null,
  };
}

export async function listarProductos(
  filtros: FiltrosProductos = {}
): Promise<{ productos: Producto[]; error: PostgrestError | null }> {
  const { data, error } = await buildQuery(filtros);

  if (error) {
    return { productos: [], error };
  }

  return {
    productos: ((data ?? []) as ProductoDb[]).map(normalizarProducto),
    error: null,
  };
}

export async function crearProducto(
  input: ProductoInput
): Promise<{ producto: Producto | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("productos")
    .insert(payloadDesdeInput(input))
    .select(COLUMNAS_PRODUCTO)
    .single();

  if (error || !data) {
    return { producto: null, error };
  }

  return {
    producto: normalizarProducto(data as ProductoDb),
    error: null,
  };
}

export async function actualizarProducto(
  id: string,
  input: ProductoInput
): Promise<{ producto: Producto | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("productos")
    .update(payloadDesdeInput(input))
    .eq("id", id)
    .select(COLUMNAS_PRODUCTO)
    .single();

  if (error || !data) {
    return { producto: null, error };
  }

  return {
    producto: normalizarProducto(data as ProductoDb),
    error: null,
  };
}

export async function cambiarEstadoProducto(
  producto: Producto,
  activo: boolean
): Promise<{ producto: Producto | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from("productos")
    .update({ activo })
    .eq("id", producto.id)
    .select(COLUMNAS_PRODUCTO)
    .single();

  if (error || !data) {
    return { producto: null, error };
  }

  return {
    producto: normalizarProducto(data as ProductoDb),
    error: null,
  };
}
