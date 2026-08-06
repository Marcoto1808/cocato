import { normalizarTextoPedido } from "./cantidad-natural.ts";
import type { ProductoCatalogo } from "../repositories/product.repository.ts";

const PALABRA_A_NUMERO: Record<string, number> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  medio: 0.5,
  media: 0.5,
};

export function singularizarPalabra(palabra: string): string {
  const t = normalizarTextoPedido(palabra);
  if (t.length <= 2) return t;

  if (/^\d+(?:[.,]\d+)?$/.test(t)) return t;

  if (t.endsWith("es") && t.length > 4) {
    if (t.endsWith("bles")) return t.slice(0, -1);
    if (t.endsWith("tes")) return t.slice(0, -1);
    if (t.endsWith("ces")) return t.slice(0, -2) + "z";
    return t.slice(0, -2);
  }

  if (t.endsWith("s") && !t.endsWith("ss")) {
    return t.slice(0, -1);
  }

  return t;
}

export function normalizarNombreProducto(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .map(singularizarPalabra)
    .join(" ");
}

function pluralizarPalabra(palabra: string): string {
  const t = normalizarTextoPedido(palabra);
  if (!t || t.endsWith("s")) return t;
  if (t.endsWith("z")) return `${t.slice(0, -1)}ces`;
  return `${t}s`;
}

export function variantesNombreProducto(nombre: string): string[] {
  const base = normalizarTextoPedido(nombre.trim());
  const singular = normalizarNombreProducto(nombre);
  const plural = nombre
    .split(/\s+/)
    .filter(Boolean)
    .map(pluralizarPalabra)
    .join(" ");

  return [...new Set([base, singular, plural, normalizarTextoPedido(plural)])];
}

export function nombresEquivalentes(a: string, b: string): boolean {
  return normalizarNombreProducto(a) === normalizarNombreProducto(b);
}

function parsearTokenCantidad(
  token: string,
  fraccion?: string
): { cantidad: number; cantidadTexto: string } | null {
  const t = token.trim().toLowerCase();
  let base: number | null = null;

  if (/^\d+(?:[.,]\d+)?$/.test(t)) {
    base = Number(t.replace(",", "."));
  } else {
    base = PALABRA_A_NUMERO[t] ?? null;
  }

  if (base == null || !Number.isFinite(base) || base <= 0) return null;

  if (fraccion && /^(medio|media)$/i.test(fraccion)) {
    return {
      cantidad: base + 0.5,
      cantidadTexto: `${token} y ${fraccion}`,
    };
  }

  return { cantidad: base, cantidadTexto: token };
}

export function separarCantidadInicial(texto: string): {
  cantidad: number;
  cantidadTexto: string;
  unidad: "kg" | "pieza" | null;
  resto: string;
} | null {
  const limpio = texto.trim();
  if (!limpio) return null;

  const patrones = [
    /^(\d+(?:[.,]\d+)?)(?:\s+y\s+(medio|media))?\s*(kg|kilos?|kilo)?\s*(?:de\s+)?(.+)$/i,
    /^(uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|medio|media)(?:\s+y\s+(medio|media))?\s*(kg|kilos?|kilo)?\s*(?:de\s+)?(.+)$/i,
  ];

  for (const patron of patrones) {
    const match = limpio.match(patron);
    if (!match) continue;

    const cantidadParseada = parsearTokenCantidad(match[1], match[2]);
    const unidadToken = match[3]?.toLowerCase();
    const resto = match[4]?.trim();

    if (!cantidadParseada || !resto) continue;

    const unidad =
      unidadToken && /^(kg|kilos?|kilo)$/.test(unidadToken) ? "kg" : unidadToken ? "pieza" : null;

    return {
      cantidad: cantidadParseada.cantidad,
      cantidadTexto: cantidadParseada.cantidadTexto,
      unidad,
      resto,
    };
  }

  return null;
}

export function tienePrefijoCantidad(texto: string): boolean {
  return separarCantidadInicial(texto) !== null;
}

export function productosPorEspecificidad(
  productos: ProductoCatalogo[]
): ProductoCatalogo[] {
  return [...productos]
    .filter((producto) => producto.activo)
    .sort(
      (a, b) =>
        normalizarNombreProducto(b.nombre).length -
        normalizarNombreProducto(a.nombre).length
    );
}

export function resolverProductoEnCatalogo(
  nombreBuscado: string,
  productos: ProductoCatalogo[]
):
  | { tipo: "ok"; producto: ProductoCatalogo }
  | { tipo: "ambiguo"; opciones: string[] }
  | { tipo: "no_encontrado" } {
  const buscado = nombreBuscado.trim();
  if (!buscado) return { tipo: "no_encontrado" };

  const buscadoNorm = normalizarNombreProducto(buscado);
  const ordenados = productosPorEspecificidad(productos);

  for (const producto of ordenados) {
    if (nombresEquivalentes(buscado, producto.nombre)) {
      return { tipo: "ok", producto };
    }

    for (const variante of variantesNombreProducto(producto.nombre)) {
      if (buscadoNorm === normalizarNombreProducto(variante)) {
        return { tipo: "ok", producto };
      }
    }
  }

  const candidatos: ProductoCatalogo[] = [];

  for (const producto of ordenados) {
    const catalogoNorm = normalizarNombreProducto(producto.nombre);

    if (buscadoNorm === catalogoNorm) {
      candidatos.push(producto);
      continue;
    }

    if (buscadoNorm.startsWith(`${catalogoNorm} `)) {
      candidatos.push(producto);
      continue;
    }

    if (catalogoNorm.startsWith(`${buscadoNorm} `)) {
      candidatos.push(producto);
    }
  }

  if (candidatos.length === 1) {
    return { tipo: "ok", producto: candidatos[0] };
  }

  if (candidatos.length > 1) {
    const opciones = [...new Set(candidatos.map((p) => p.nombre))].slice(0, 5);
    return { tipo: "ambiguo", opciones };
  }

  return { tipo: "no_encontrado" };
}

export function pareceNombreProducto(
  texto: string,
  productos: ProductoCatalogo[]
): ProductoCatalogo | null {
  if (tienePrefijoCantidad(texto)) return null;

  const resolucion = resolverProductoEnCatalogo(texto, productos);
  if (resolucion.tipo === "ok") return resolucion.producto;
  return null;
}

export function extraerCantidadYProducto(
  segmento: string,
  productos: ProductoCatalogo[]
): {
  cantidad: number;
  cantidadTexto: string;
  unidad: "kg" | "pieza" | null;
  producto: ProductoCatalogo;
} | null {
  const separado = separarCantidadInicial(segmento);
  if (!separado) return null;

  const resolucion = resolverProductoEnCatalogo(separado.resto, productos);
  if (resolucion.tipo !== "ok") return null;

  return {
    cantidad: separado.cantidad,
    cantidadTexto: separado.cantidadTexto,
    unidad: separado.unidad,
    producto: resolucion.producto,
  };
}
