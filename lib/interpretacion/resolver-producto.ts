import type { ProductoCatalogo } from "@/lib/interpretacion/mensaje-interpreter";
import {
  normalizarCantidadTextoParaDisplay,
  normalizarTextoPedido,
} from "@/lib/interpretacion/cantidad-natural";

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

/** Singulariza una palabra en español (capotes → capote, dobles → doble). */
export function singularizarPalabra(palabra: string): string {
  const t = normalizarTextoPedido(palabra);
  if (t.length <= 2) return t;

  if (/^\d+(?:[.,]\d+)?$/.test(t)) return t;

  if (t.endsWith("es") && t.length > 4) {
    if (t.endsWith("bles")) return t.slice(0, -1);
    if (t.endsWith("tes")) return t.slice(0, -1);
    if (t.endsWith("ces")) return t.slice(0, -2) + "z";
    if (t.endsWith("nes")) return t.slice(0, -1);
    return t.slice(0, -1);
  }

  if (t.endsWith("s") && !t.endsWith("ss")) {
    return t.slice(0, -1);
  }

  return t;
}

const PALABRAS_SIN_PLURALIZAR = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "el",
  "en",
  "la",
  "las",
  "los",
  "para",
  "sin",
  "y",
]);

/**
 * Normaliza plurales comerciales a singular antes de buscar en catálogo.
 * Solo uso interno de interpretación; no altera nombres almacenados.
 */
export function normalizarPluralesComerciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";

  return partes
    .map((parte, indice) => {
      const parteNorm = normalizarTextoPedido(parte);
      const anteriorNorm =
        indice > 0 ? normalizarTextoPedido(partes[indice - 1]) : "";

      if (PALABRAS_SIN_PLURALIZAR.has(parteNorm)) return parteNorm;
      if (PALABRAS_SIN_PLURALIZAR.has(anteriorNorm)) return parteNorm;

      return singularizarPalabra(parte);
    })
    .join(" ");
}

/** Normaliza un nombre de producto ignorando plurales y acentos. */
export function normalizarNombreProducto(nombre: string): string {
  return normalizarPluralesComerciales(nombre);
}

function pluralizarPalabra(palabra: string): string {
  const t = normalizarTextoPedido(palabra);
  if (!t || t.endsWith("s")) return t;
  if (t.endsWith("z")) return `${t.slice(0, -1)}ces`;
  return `${t}s`;
}

/** Variantes singular/plural para comparar con lo que escribe el cliente. */
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

/**
 * Separa cantidad inicial y resto del texto.
 * Ej: "2 capotes dobles" → cantidad 2, resto "capotes dobles"
 */
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

    const unidadFinal: "kg" | "pieza" = unidad ?? "pieza";

    return {
      cantidad: cantidadParseada.cantidad,
      cantidadTexto: normalizarCantidadTextoParaDisplay({
        cantidad: cantidadParseada.cantidad,
        unidad: unidadFinal,
        cantidadTexto: cantidadParseada.cantidadTexto,
        segmento: limpio,
      }),
      unidad,
      resto,
    };
  }

  return null;
}

export function tienePrefijoCantidad(texto: string): boolean {
  return separarCantidadInicial(texto) !== null;
}

/** Catálogo activo ordenado por especificidad (nombre más largo primero). */
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

function dedupeProductos(productos: ProductoCatalogo[]): ProductoCatalogo[] {
  const vistos = new Set<string>();
  const opciones: ProductoCatalogo[] = [];

  for (const producto of productos) {
    if (vistos.has(producto.id)) continue;
    vistos.add(producto.id);
    opciones.push(producto);
    if (opciones.length >= 5) break;
  }

  return opciones;
}

function distanciaLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const filas = a.length + 1;
  const columnas = b.length + 1;
  const matrix = Array.from({ length: filas }, () =>
    Array<number>(columnas).fill(0)
  );

  for (let i = 0; i < filas; i += 1) matrix[i][0] = i;
  for (let j = 0; j < columnas; j += 1) matrix[0][j] = j;

  for (let i = 1; i < filas; i += 1) {
    for (let j = 1; j < columnas; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + costo
      );
    }
  }

  return matrix[a.length][b.length];
}

function limiteDistanciaAproximada(palabra: string): number {
  if (palabra.length <= 4) return 1;
  return 2;
}

function palabraPrincipalProducto(nombre: string): string {
  return normalizarNombreProducto(nombre).split(/\s+/).filter(Boolean)[0] ?? "";
}

function resolverProductoPorCoincidenciaAproximada(
  buscadoNorm: string,
  productos: ProductoCatalogo[]
): ProductoCatalogo | null {
  const palabraBuscada = buscadoNorm.split(/\s+/).filter(Boolean)[0] ?? "";
  if (palabraBuscada.length < 4) return null;

  const limite = limiteDistanciaAproximada(palabraBuscada);
  let mejor: { producto: ProductoCatalogo; dist: number } | null = null;

  for (const producto of productos) {
    const candidatos = new Set<string>([
      palabraPrincipalProducto(producto.nombre),
      ...(producto.aliases ?? []).map((alias) => palabraPrincipalProducto(alias)),
    ]);

    for (const candidato of candidatos) {
      if (candidato.length < 4) continue;
      const dist = distanciaLevenshtein(palabraBuscada, candidato);
      if (dist > limite) continue;

      if (!mejor || dist < mejor.dist) {
        mejor = { producto, dist };
      } else if (mejor && dist === mejor.dist && producto.id !== mejor.producto.id) {
        return null;
      }
    }
  }

  return mejor?.producto ?? null;
}

function resolverProductoPorAlias(
  buscadoNorm: string,
  productos: ProductoCatalogo[]
): ProductoCatalogo | null {
  let encontrado: ProductoCatalogo | null = null;

  for (const producto of productos) {
    for (const alias of producto.aliases ?? []) {
      if (normalizarNombreProducto(alias) !== buscadoNorm) continue;
      if (encontrado && encontrado.id !== producto.id) {
        return null;
      }
      encontrado = producto;
    }
  }

  return encontrado;
}

export type ContextoResolucionProducto = {
  categoriaContexto?: string | null;
};

export function resolverProductoEnCatalogo(
  nombreBuscado: string,
  productos: ProductoCatalogo[],
  _contexto?: ContextoResolucionProducto
):
  | { tipo: "ok"; producto: ProductoCatalogo }
  | { tipo: "ambiguo"; opciones: ProductoCatalogo[] }
  | { tipo: "no_encontrado" } {
  const buscado = nombreBuscado.trim();
  if (!buscado) return { tipo: "no_encontrado" };

  const buscadoNorm = normalizarPluralesComerciales(buscado);
  const ordenados = productosPorEspecificidad(productos);
  const exactos: ProductoCatalogo[] = [];

  for (const producto of ordenados) {
    if (nombresEquivalentes(buscado, producto.nombre)) {
      exactos.push(producto);
    }
  }

  if (exactos.length === 1) {
    return { tipo: "ok", producto: exactos[0] };
  }

  if (exactos.length > 1) {
    return { tipo: "ambiguo", opciones: dedupeProductos(exactos) };
  }

  const porAlias = resolverProductoPorAlias(buscadoNorm, ordenados);
  if (porAlias) {
    return { tipo: "ok", producto: porAlias };
  }

  const parciales: ProductoCatalogo[] = [];
  for (const producto of ordenados) {
    const catalogoNorm = normalizarNombreProducto(producto.nombre);
    if (catalogoNorm.startsWith(`${buscadoNorm} `)) {
      parciales.push(producto);
    }
  }

  if (parciales.length >= 1) {
    return { tipo: "ambiguo", opciones: dedupeProductos(parciales) };
  }

  const aproximado = resolverProductoPorCoincidenciaAproximada(
    buscadoNorm,
    ordenados
  );
  if (aproximado) {
    return { tipo: "ok", producto: aproximado };
  }

  return { tipo: "no_encontrado" };
}

/** Solo producto, sin cantidad al inicio del mensaje. */
export function pareceNombreProducto(
  texto: string,
  productos: ProductoCatalogo[],
  contexto?: ContextoResolucionProducto
): ProductoCatalogo | null {
  if (tienePrefijoCantidad(texto)) return null;

  const resolucion = resolverProductoEnCatalogo(texto, productos, contexto);
  if (resolucion.tipo === "ok") return resolucion.producto;
  return null;
}

/**
 * Extrae cantidad + producto del segmento usando catálogo (nombre más largo primero).
 * Cubre casos como "2 capotes dobles" cuando el parser de segmento no alcanza.
 */
export function extraerCantidadYProducto(
  segmento: string,
  productos: ProductoCatalogo[],
  contexto?: ContextoResolucionProducto
): {
  cantidad: number;
  cantidadTexto: string;
  unidad: "kg" | "pieza" | null;
  producto: ProductoCatalogo;
} | null {
  const separado = separarCantidadInicial(segmento);
  if (!separado) return null;

  const resolucion = resolverProductoEnCatalogo(separado.resto, productos, contexto);
  if (resolucion.tipo !== "ok") return null;

  return {
    cantidad: separado.cantidad,
    cantidadTexto: separado.cantidadTexto,
    unidad: separado.unidad,
    producto: resolucion.producto,
  };
}
