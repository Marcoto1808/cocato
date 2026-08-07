import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type ProductoCatalogo = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  precio_kg: number;
  tipo_calculo: string | null;
  activo: boolean;
  aliases?: string[];
};

export async function listarProductosCompletos(
  db: SupabaseClient
): Promise<ProductoCatalogo[]> {
  const { data, error } = await db
    .from("productos")
    .select("id, nombre, categoria, unidad, precio_kg, tipo_calculo, activo")
    .eq("activo", true)
    .order("nombre");

  if (error) throw new Error(error.message);

  const productos = (data ?? []) as ProductoCatalogo[];
  if (productos.length === 0) return productos;

  const ids = productos.map((producto) => producto.id);
  const { data: aliasesData, error: aliasesError } = await db
    .from("producto_aliases")
    .select("producto_id, alias")
    .in("producto_id", ids);

  if (aliasesError) throw new Error(aliasesError.message);

  const aliasesPorProducto = new Map<string, string[]>();
  for (const fila of aliasesData ?? []) {
    const actuales = aliasesPorProducto.get(fila.producto_id) ?? [];
    actuales.push(fila.alias);
    aliasesPorProducto.set(fila.producto_id, actuales);
  }

  return productos.map((producto) => ({
    ...producto,
    aliases: aliasesPorProducto.get(producto.id) ?? [],
  }));
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function buscarProductoPorNombre(
  nombreBuscado: string,
  productos: ProductoCatalogo[]
): ProductoCatalogo | null {
  const buscado = normalizarTexto(nombreBuscado);
  if (!buscado) return null;

  const ordenados = [...productos].sort(
    (a, b) => b.nombre.length - a.nombre.length
  );

  const exacto = ordenados.find(
    (p) => normalizarTexto(p.nombre) === buscado
  );
  if (exacto) return exacto;

  return (
    ordenados.find((p) => {
      const nombre = normalizarTexto(p.nombre);
      return nombre.includes(buscado) || buscado.includes(nombre);
    }) ?? null
  );
}

export function catalogoParaPrompt(productos: ProductoCatalogo[]): string {
  return productos
    .map((p) => `- ${p.nombre} (unidad catálogo: ${p.unidad})`)
    .join("\n");
}
