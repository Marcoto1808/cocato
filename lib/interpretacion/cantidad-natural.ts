import { normalizarLenguajeComercial } from "@/lib/interpretacion/lenguaje-comercial";

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
    /\b(\d+(?:[.,]\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:kilos?|kg)\s+y\s+cuarto\b/gi,
    (_, token: string) => {
      const base = numeroDesdeToken(token) ?? 0;
      return `${base + 0.25} kg`;
    }
  );

  t = t.replace(/\b(?:kilos?|kg)\s+y\s+cuarto\b/gi, "1.25 kg");

  t = t.replace(
    /\b(\d+(?:[.,]\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:kilos?|kg)\s+y\s+medio\b/gi,
    (_, token: string) => {
      const base = numeroDesdeToken(token) ?? 0;
      return `${base + 0.5} kg`;
    }
  );

  t = t.replace(/\b(?:kilos?|kg)\s+y\s+medio\b/gi, "1.5 kg");

  t = t.replace(/\b(?:medio|media)\s+(?:kilos?|kg)\b/gi, "0.5 kg");

  t = t.replace(/\bkilo\s+de\s+/gi, "1 kg de ");

  t = t.replace(/(?<!\d\s*(?:[.,]\d+)?\s)\bkilo\b(?!\s+y\b)/gi, "1 kg");

  return t.replace(/\s+/g, " ").trim();
}

export function segmentarMensajePedido(texto: string): string[] {
  const normalizado = normalizarExpresionesCantidad(texto);
  const protegido = normalizado.replace(
    /(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|capote|capotes)\s+y\s+(medio|media)/gi,
    "$1 __Y_MEDIO__"
  );

  return protegido
    .split(/[\n,;]+|\s+y\s+/i)
    .map((parte) => parte.replace(/__Y_MEDIO__/gi, "y medio").trim())
    .filter(Boolean);
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

  return resultado(
    cantidad,
    formatearCantidad(cantidad),
    parsearUnidad(match[2]),
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
      cantidadTexto: tokens[0],
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

export function pluralizarNombreProducto(nombre: string, cantidad: number): string {
  if (cantidad === 1) return nombre;
  if (nombre.endsWith("s")) return nombre;

  if (nombre.includes(" ")) {
    return nombre
      .split(" ")
      .map((parte) => (parte.endsWith("s") ? parte : `${parte}s`))
      .join(" ");
  }

  return `${nombre}s`;
}

export function formatearCantidadEnResumen(
  cantidad: number,
  unidad: "kg" | "pieza",
  productoNombre: string,
  cantidadTexto?: string | null
): string {
  if (unidad === "kg") {
    const cantidadStr = cantidadTexto?.trim() || `${formatearCantidad(cantidad)} kg`;
    return `• ${cantidadStr} ${productoNombre}`;
  }

  const nombre = pluralizarNombreProducto(productoNombre, cantidad);
  const cantidadStr = cantidadTexto?.trim() || formatearCantidad(cantidad);
  return `• ${cantidadStr} ${nombre}`;
}
