import { normalizarLenguajeComercial } from "@/lib/interpretacion/lenguaje-comercial";
import {
  esCantidadImporte,
  importeFijoDesdeCantidad,
  parsearCantidadCaptura,
  type CantidadCapturada,
} from "@/lib/pedido-cantidad";

export type SegmentoParseado = {
  cantidad: number;
  cantidadTexto: string;
  unidad: "kg" | "pieza" | null;
  productoTexto: string;
  observaciones: string[];
};

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

const FRASES_OBSERVACION = [
  "sin grasa",
  "sin hueso",
  "sin piel",
  "sin tapa",
  "con hueso",
  "magro",
  "especial",
];

const UNIDADES_KG = new Set(["kg", "kilo", "kilos", "kilogramo", "kilogramos"]);
const UNIDADES_PIEZA = new Set([
  "pz",
  "pza",
  "pieza",
  "piezas",
  "paquete",
  "paquetes",
  "caja",
  "cajas",
]);

export function normalizarTextoPedido(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function limpiarPrefijoPedido(texto: string): string {
  let t = texto
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(
      /^(?:hola[,!.\s]*)?(?:buenos?\s+d[ií]as[,!.\s]*)?(?:buenas?\s+tardes[,!.\s]*)?(?:buenas?\s+noches[,!.\s]*)?/i,
      ""
    )
    .replace(
      /^(?:me\s+puedes?\s+m(?:and(?:ar|as)|e\s+mand(?:ar|as))[,.\s]*)?/i,
      ""
    )
    .trim();

  return normalizarLenguajeComercial(t);
}

function numeroDesdeToken(token: string): number | null {
  const t = token.toLowerCase();
  if (/^\d+(?:[.,]\d+)?$/.test(t)) {
    return Number(t.replace(",", "."));
  }
  return PALABRA_A_NUMERO[t] ?? null;
}

/** Convierte expresiones comunes de peso a cantidades numéricas antes del parseo. */
export function normalizarExpresionesCantidad(texto: string): string {
  let t = normalizarTextoPedido(texto);
  if (!t) return t;

  t = t.replace(
    /\b(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+cuartos?\s+de\s+(?:kilos?|kg)\b/gi,
    (_, palabra: string) => {
      const base = numeroDesdeToken(palabra) ?? 0;
      return `${base * 0.25} kg`;
    }
  );

  t = t.replace(/\bcuarto\s+de\s+(?:kilos?|kg)\b/gi, "0.25 kg");

  t = t.replace(
    /\b(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+cuartos?\s+de\s+(?!kilos?\b|kg\b)/gi,
    (_, palabra: string) => {
      const base = numeroDesdeToken(palabra) ?? 0;
      return `${base * 0.25} kg de `;
    }
  );

  t = t.replace(/\bcuarto\s+de\s+(?!kilos?\b|kg\b)/gi, "0.25 kg de ");

  t = t.replace(
    /\b(\d+(?:[.,]\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:kilos?|kg)\s+y\s+cuarto\b/gi,
    (_, token: string) => {
      const base = numeroDesdeToken(token) ?? 0;
      return `${base + 0.25} kg`;
    }
  );

  t = t.replace(/\b(?:kilos?|kg)\s+y\s+cuarto(\s+de\s+)?/gi, "1.25 kg$1");

  t = t.replace(
    /\b(\d+(?:[.,]\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:kilos?|kg)\s+y\s+medio\b/gi,
    (_, token: string) => {
      const base = numeroDesdeToken(token) ?? 0;
      return `${base + 0.5} kg`;
    }
  );

  t = t.replace(/\b(?:kilos?|kg)\s+y\s+medio(\s+de\s+)?/gi, "1.5 kg$1");

  t = t.replace(/\b(?:medio|media)\s+(?:kilos?|kg)\b/gi, "0.5 kg");

  t = t.replace(/\bkilo\s+de\s+/gi, "1 kg de ");

  t = t.replace(/(?<!\d\s*(?:[.,]\d+)?\s)\bkilo\b(?!\s+y\b)/gi, "1 kg");

  return t.replace(/\s+/g, " ").trim();
}

const PALABRAS_CANTIDAD_SEGMENTO =
  "un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta";

const CONECTORES_SEGMENTO =
  /\s+(?:y|e|también|tambien|mas|más|ademas|además|plus|\+)\s+/gi;

/** Protege expresiones compuestas de cantidad para no partirlas al segmentar. */
function protegerExpresionesCantidadSegmento(bloque: string): string {
  return bloque
    .replace(/\b(?:kilos?|kg)\s+y\s+medio\b/gi, "__KILO_Y_MEDIO__")
    .replace(/\b(?:kilos?|kg)\s+y\s+cuarto\b/gi, "__KILO_Y_CUARTO__")
    .replace(
      /(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|capote|capotes)\s+y\s+(medio|media)/gi,
      "$1 __Y_MEDIO__"
    );
}

function restaurarExpresionesCantidadSegmento(texto: string): string {
  return texto
    .replace(/__KILO_Y_MEDIO__/gi, "kilos y medio")
    .replace(/__KILO_Y_CUARTO__/gi, "kilos y cuarto")
    .replace(/__Y_MEDIO__/gi, "y medio");
}

/** Separa cantidades pegadas al nombre: "3piernas4espaldillas" → "3 piernas 4 espaldillas". */
export function desconcatenarCantidadesProductoSinEspacio(bloque: string): string {
  const particulasPegadas =
    /(?<=[\p{L}])(de|del|kilos?|kilo|kg|pesos?|piezas?|pz|pza)(?=[\p{L}])/giu;

  let texto = bloque
    .replace(/([\p{L}])(\d+(?=[\p{L}]))/gu, "$1 $2")
    .replace(/(\d+(?:[.,]\d+)?)(?=[\p{L}])/gu, "$1 ");

  for (let paso = 0; paso < 4; paso += 1) {
    const siguiente = texto.replace(particulasPegadas, " $1 ");
    if (siguiente === texto) break;
    texto = siguiente;
  }

  texto = texto.replace(
    /\b(\d+(?:[.,]\d+)?)\s+(?!de\b|pesos?\b|kg\b|kilos?\b|kilo\b|piezas?\b|pz\b|pza\b)([\p{L}])/giu,
    (coincidencia, cantidad, inicioProducto) => {
      const importe = Number(String(cantidad).replace(",", "."));
      if (!Number.isFinite(importe) || importe < 20) return coincidencia;
      return `${cantidad} de ${inicioProducto}`;
    }
  );

  return texto.replace(/\s+/g, " ").trim();
}

/**
 * Parte un bloque sin comas detectando el inicio de cantidad + producto,
 * kilos + producto o pesos + producto.
 */
function partirBloquePorNuevosProductos(bloque: string): string[] {
  const bloqueNormalizado = desconcatenarCantidadesProductoSinEspacio(bloque);
  const separador = new RegExp(
    `(?<=\\S)\\s+(?=` +
      `\\d+(?:[.,]\\d+)?(?:\\s+(?:pesos?|kg|kilos?|kilo|piezas?|pz|pza|de)\\b|\\s+(?!y\\s+(?:medio|media|cuarto)\\b)[\\p{L}])` +
      `|` +
      `\\b(?:${PALABRAS_CANTIDAD_SEGMENTO}|medio|media)\\b(?:\\s+(?:kilos?|kg|kilo|y\\s+medio|y\\s+cuarto|cuartos?\\s+de|pesos?|de)\\b|\\s+(?!y\\s+(?:medio|media|cuarto)\\b)[\\p{L}])` +
      `)`,
    "giu"
  );

  return bloqueNormalizado
    .split(separador)
    .map((parte) => parte.trim())
    .filter(Boolean);
}

function segmentarBloqueComercial(bloque: string): string[] {
  const protegido = protegerExpresionesCantidadSegmento(bloque);
  const porConectores = protegido.split(CONECTORES_SEGMENTO);
  const segmentos: string[] = [];

  for (const trozo of porConectores) {
    const partes = partirBloquePorNuevosProductos(trozo);
    for (const parte of partes) {
      const limpio = restaurarExpresionesCantidadSegmento(parte).trim();
      if (!limpio) continue;
      segmentos.push(normalizarExpresionesCantidad(limpio));
    }
  }

  return segmentos;
}

export function segmentarMensajePedido(texto: string): string[] {
  const bloques = texto
    .split(/[\n,;]+/)
    .map((parte) => parte.trim())
    .filter(Boolean);

  return bloques.flatMap(segmentarBloqueComercial).filter(Boolean);
}

export function extraerObservaciones(texto: string): {
  resto: string;
  observaciones: string[];
} {
  const observaciones: string[] = [];
  let resto = texto;

  for (const frase of FRASES_OBSERVACION) {
    const regex = new RegExp(`\\b${frase.replace(/\s+/g, "\\s+")}\\b`, "gi");
    if (regex.test(resto)) {
      observaciones.push(frase);
      resto = resto.replace(regex, " ").replace(/\s+/g, " ").trim();
    }
  }

  return { resto, observaciones };
}

function formatearCantidad(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : String(valor);
}

function palabraANumero(token: string): number | null {
  const valor = PALABRA_A_NUMERO[token.toLowerCase()];
  return valor ?? null;
}

function parsearUnidad(token: string | undefined): "kg" | "pieza" | null {
  if (!token) return null;
  const t = token.toLowerCase();
  if (UNIDADES_KG.has(t)) return "kg";
  if (UNIDADES_PIEZA.has(t)) return "pieza";
  return null;
}

function limpiarProductoTexto(texto: string): string {
  return texto
    .replace(/^(?:de\s+)+/i, "")
    .replace(/\s+(?:de\s+)+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resultado(
  cantidad: number,
  cantidadTexto: string,
  unidad: "kg" | "pieza" | null,
  productoTexto: string,
  observaciones: string[]
): SegmentoParseado | null {
  const producto = limpiarProductoTexto(productoTexto);
  if (!producto || cantidad <= 0 || !Number.isFinite(cantidad)) return null;

  return {
    cantidad,
    cantidadTexto,
    unidad,
    productoTexto: producto,
    observaciones,
  };
}

function parsearPatronYMedio(
  segmento: string,
  observaciones: string[]
): SegmentoParseado | null {
  const match = segmento.match(
    /^(.+?)\s+y\s+(medio|media)(?:\s+(?:de\s+)?(.+))?$/i
  );
  if (!match) return null;

  const basePart = match[1].trim();
  const productoExplicito = match[3]?.trim();

  const baseNumerico = basePart.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (baseNumerico) {
    const cantidadBase = Number(baseNumerico[1].replace(",", "."));
    const restoBase = baseNumerico[2].trim();
    const producto = productoExplicito || restoBase;
    if (!producto) return null;
    const cantidad = cantidadBase + 0.5;
    return resultado(
      cantidad,
      `${formatearCantidad(cantidadBase)} y medio`,
      null,
      producto,
      observaciones
    );
  }

  const tokens = basePart.split(/\s+/);
  const primerToken = tokens[0]?.toLowerCase();
  const numeroPalabra = primerToken ? palabraANumero(primerToken) : null;

  if (numeroPalabra != null && tokens.length >= 1) {
    const restoBase = tokens.slice(1).join(" ").trim();
    const producto = productoExplicito || restoBase;
    if (!producto) return null;
    const cantidad = numeroPalabra + 0.5;
    return resultado(
      cantidad,
      `${primerToken} y medio`,
      null,
      producto,
      observaciones
    );
  }

  const producto = productoExplicito || basePart;
  if (!producto) return null;
  return resultado(1.5, "uno y medio", null, producto, observaciones);
}

function parsearPatronMedioPrimero(
  segmento: string,
  observaciones: string[]
): SegmentoParseado | null {
  const match = segmento.match(/^(medio|media)(?:\s+(?:de\s+)?(.+))?$/i);
  if (!match) return null;

  const producto = match[2]?.trim();
  if (!producto) return null;

  return resultado(0.5, match[1].toLowerCase(), null, producto, observaciones);
}

function parsearPatronNumerico(
  segmento: string,
  observaciones: string[]
): SegmentoParseado | null {
  const match = segmento.match(
    /^(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kilo|piezas?|pz|pza|paquetes?|cajas?)?\s*(?:de\s+)?(.+)$/i
  );
  if (!match) return null;

  const cantidad = Number(match[1].replace(",", "."));
  const producto = match[3]?.trim();
  if (!producto) return null;

  const unidad = parsearUnidad(match[2]);

  return resultado(
    cantidad,
    unidad ? `${formatearCantidad(cantidad)} kg` : formatearCantidad(cantidad),
    unidad,
    producto,
    observaciones
  );
}

function parsearPatronPalabras(
  segmento: string,
  observaciones: string[]
): SegmentoParseado | null {
  const tokens = segmento.split(/\s+/);
  if (tokens.length < 2) return null;

  const cantidadCompuesta = (() => {
    if (tokens.length >= 3 && tokens[1] === "y" && /^(medio|media)$/i.test(tokens[2])) {
      const base = palabraANumero(tokens[0]);
      if (base == null) return null;
      const producto = tokens.slice(3).join(" ").trim();
      if (!producto) return null;
      return {
        cantidad: base + 0.5,
        cantidadTexto: `${tokens[0]} y ${tokens[2]}`,
        producto,
        unidad: null as "kg" | "pieza" | null,
      };
    }

    const base = palabraANumero(tokens[0]);
    if (base == null) return null;

    const unidad = parsearUnidad(tokens[1]);
    const inicioProducto = unidad ? 2 : 1;
    let producto = tokens.slice(inicioProducto).join(" ").trim();
    producto = producto.replace(/^de\s+/i, "").trim();
    if (!producto) return null;

    return {
      cantidad: base,
      cantidadTexto: unidad ? `${tokens[0]} kg` : tokens[0],
      producto,
      unidad,
    };
  })();

  if (!cantidadCompuesta) return null;

  return resultado(
    cantidadCompuesta.cantidad,
    cantidadCompuesta.cantidadTexto,
    cantidadCompuesta.unidad,
    cantidadCompuesta.producto,
    observaciones
  );
}

export function parsearSegmentoPedido(segmento: string): SegmentoParseado | null {
  const limpio = normalizarExpresionesCantidad(limpiarPrefijoPedido(segmento));
  if (!limpio) return null;

  const { resto, observaciones } = extraerObservaciones(limpio);

  return (
    parsearPatronYMedio(resto, observaciones) ??
    parsearPatronMedioPrimero(resto, observaciones) ??
    parsearPatronNumerico(resto, observaciones) ??
    parsearPatronPalabras(resto, observaciones)
  );
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

function aplicarCasingOriginal(original: string, transformado: string): string {
  if (!original || !transformado) return transformado;
  if (original === original.toUpperCase()) return transformado.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return transformado.charAt(0).toUpperCase() + transformado.slice(1);
  }
  return transformado;
}

function singularizarPalabraDisplay(palabra: string): string {
  const lower = palabra.toLowerCase();
  if (lower.length <= 2 || /^\d/.test(lower)) return palabra;
  if (!lower.endsWith("s") || lower.endsWith("ss")) return palabra;

  let base: string;
  if (lower.endsWith("es") && lower.length > 4) {
    if (lower.endsWith("bles")) base = lower.slice(0, -1);
    else if (lower.endsWith("tes")) base = lower.slice(0, -1);
    else if (lower.endsWith("ces")) base = lower.slice(0, -2) + "z";
    else if (lower.endsWith("nes")) base = lower.slice(0, -1);
    else base = lower.slice(0, -1);
  } else {
    base = lower.slice(0, -1);
  }

  return aplicarCasingOriginal(palabra, base);
}

function pluralizarPalabraDisplay(palabra: string): string {
  const lower = palabra.toLowerCase();
  if (lower.length <= 2 || /^\d/.test(lower)) return palabra;
  if (lower.endsWith("s") && !lower.endsWith("ss")) return palabra;

  const base = lower.endsWith("z") ? `${lower.slice(0, -1)}ces` : `${lower}s`;
  return aplicarCasingOriginal(palabra, base);
}

function ajustarPalabraPorCantidad(palabra: string, cantidad: number): string {
  if (PALABRAS_SIN_PLURALIZAR.has(palabra.toLowerCase())) return palabra;
  return cantidad === 1
    ? singularizarPalabraDisplay(palabra)
    : pluralizarPalabraDisplay(palabra);
}

/** Ajusta singular/plural del nombre solo para presentación al cliente. */
export function pluralizarNombreProducto(nombre: string, cantidad: number): string {
  if (!Number.isFinite(cantidad) || cantidad <= 0) return nombre;

  const cantidadReferencia = cantidad === 1 ? 1 : 2;
  const partes = nombre.split(/\s+/).filter(Boolean);

  return partes
    .map((parte, indice) => {
      const anterior =
        indice > 0 ? partes[indice - 1].toLowerCase() : "";
      if (PALABRAS_SIN_PLURALIZAR.has(parte.toLowerCase())) return parte;
      if (PALABRAS_SIN_PLURALIZAR.has(anterior)) return parte;
      return ajustarPalabraPorCantidad(parte, cantidadReferencia);
    })
    .join(" ");
}

/** Extrae el texto del producto conservando mayúsculas/minúsculas del cliente. */
export function extraerProductoTextoCliente(segmento: string): string {
  const limpio = limpiarPrefijoPedido(segmento.trim()).replace(/[.!?]+$/, "");
  const { resto } = extraerObservaciones(limpio);
  if (!resto) return "";

  const patrones = [
    /^\$\s*(\d+(?:[.,]\d+)?)\s*(?:de\s+)?(.+)$/i,
    /^(\d+(?:[.,]\d+)?)\s*pesos?\s+(?:de\s+)?(.+)$/i,
    /^(\d+(?:[.,]\d+)?)(?:\s+y\s+(medio|media))?(?:\s+(?:kg|kilos?|kilo|pza|piezas?|pz)\b)?\s*(?:de\s+)?(.+)$/i,
    /^(uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta|cuarenta|cincuenta|medio|media)(?:\s+y\s+(medio|media))?(?:\s+(?:kg|kilos?|kilo|pza|piezas?|pz)\b)?\s*(?:de\s+)?(.+)$/i,
  ];

  for (const patron of patrones) {
    const match = resto.match(patron);
    const producto = match?.[match.length - 1]?.trim();
    if (producto) return producto;
  }

  return resto.trim();
}

/** Detecta la unidad explícita que escribió el cliente (sin inferir del catálogo). */
export function inferirUnidadExplicitaDesdeSegmento(
  segmento: string
): "kg" | "pieza" | null {
  const limpio = normalizarTextoPedido(limpiarPrefijoPedido(segmento));
  if (!limpio) return null;
  if (/\b(pesos?|\$)\b/.test(limpio)) return null;
  if (/\b(kg|kilos?|kilo)\b/.test(limpio)) return "kg";
  if (/\b(piezas?|pz|pza|paquetes?|cajas?)\b/.test(limpio)) return "pieza";
  return null;
}

export function segmentoEsImporte(segmento: string): boolean {
  const limpio = normalizarTextoPedido(limpiarPrefijoPedido(segmento));
  return (
    /\b\d+(?:[.,]\d+)?\s*pesos?\b/.test(limpio) ||
    /^\$\s*\d/.test(limpio) ||
    /^\d+\s+de\s+/.test(limpio)
  );
}

/** Normaliza cantidadTexto para mostrar al cliente sin cambiar la unidad pedida. */
export function normalizarCantidadTextoParaDisplay(input: {
  cantidad: number;
  unidad: "kg" | "pieza";
  cantidadTexto?: string | null;
  segmento?: string;
}): string {
  const cantidadTexto = input.cantidadTexto?.trim();
  const segmento = input.segmento?.trim() ?? "";

  if (
    (cantidadTexto && esCantidadImporte(cantidadTexto)) ||
    segmentoEsImporte(segmento)
  ) {
    const importe =
      importeFijoDesdeCantidad(cantidadTexto ?? segmento) ??
      importeFijoDesdeCantidad(segmento);
    if (importe != null) return `$${importe}`;
    if (cantidadTexto) return cantidadTexto;
  }

  if (input.unidad === "kg") {
    return `${formatearCantidad(input.cantidad)} kg`;
  }

  return cantidadTexto || formatearCantidad(input.cantidad);
}

export function cantidadCapturadaDesdeLineaPedido(input: {
  cantidad: number;
  cantidadTexto?: string | null;
  textoOriginal?: string | null;
}): CantidadCapturada {
  const cantidadTexto = input.cantidadTexto?.trim();
  if (cantidadTexto) {
    const parsed = parsearCantidadCaptura(cantidadTexto);
    if (parsed) return parsed;
  }

  const textoOriginal = input.textoOriginal?.trim() ?? "";
  if (textoOriginal && segmentoEsImporte(textoOriginal)) {
    const importe = importeFijoDesdeCantidad(textoOriginal);
    if (importe != null) {
      return { tipo: "importe", importe, cantidad_texto: `$${importe}` };
    }
  }

  return { tipo: "numerica", cantidad: input.cantidad };
}

export function nombreProductoEnResumenDesdeLinea(input: {
  textoOriginal?: string | null;
  productoNombre: string;
}): string {
  const desdeTexto = input.textoOriginal?.trim()
    ? extraerProductoTextoCliente(input.textoOriginal)
    : "";
  return desdeTexto || input.productoNombre;
}

export function formatearCantidadEnResumen(
  cantidad: number,
  unidad: "kg" | "pieza",
  productoNombre: string,
  cantidadTexto?: string | null,
  textoOriginal?: string | null
): string {
  const segmento = textoOriginal?.trim() ?? "";
  const cantidadDisplay = cantidadTexto?.trim() ?? "";

  if (
    (cantidadDisplay && esCantidadImporte(cantidadDisplay)) ||
    segmentoEsImporte(segmento)
  ) {
    const importe =
      importeFijoDesdeCantidad(cantidadDisplay || segmento) ??
      importeFijoDesdeCantidad(segmento);
    const monto =
      importe != null
        ? `$${importe}`
        : cantidadDisplay || segmento;
    const producto = nombreProductoEnResumenDesdeLinea({
      textoOriginal: segmento,
      productoNombre,
    });
    return `• ${monto} de ${producto}`;
  }

  const producto = nombreProductoEnResumenDesdeLinea({
    textoOriginal: segmento,
    productoNombre,
  });

  if (unidad === "kg") {
    const cantidadStr = cantidadDisplay.match(/\b(kg|kilo)/i)
      ? cantidadDisplay
      : `${formatearCantidad(cantidad)} kg`;
    return `• ${cantidadStr} de ${producto}`;
  }

  const nombre = pluralizarNombreProducto(producto, cantidad);
  const cantidadStr = cantidadDisplay || formatearCantidad(cantidad);
  return `• ${cantidadStr} ${nombre}`;
}
