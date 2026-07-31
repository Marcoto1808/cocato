import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type ProductoCatalogo = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  precio_kg: number;
  tipo_calculo: string | null;
  activo: boolean;
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
  return (data ?? []) as ProductoCatalogo[];
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
