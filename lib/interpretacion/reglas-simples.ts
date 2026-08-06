import type {
  InterpretacionMensaje,
  LineaInterpretada,
  MensajeInterpreter,
  ProductoCatalogo,
} from "@/lib/interpretacion/mensaje-interpreter";
import {
  extraerObservaciones,
  limpiarPrefijoPedido,
  normalizarTextoPedido,
  parsearSegmentoPedido,
  segmentarMensajePedido,
} from "@/lib/interpretacion/cantidad-natural";
import {
  extraerCantidadYProducto,
  pareceNombreProducto,
  resolverProductoEnCatalogo,
} from "@/lib/interpretacion/resolver-producto";

const FRASES_IA_FUTURA = [
  "lo de siempre",
  "lo mismo",
  "igual que ayer",
  "igual que el",
  "como siempre",
  "como ayer",
  "mismo pedido",
  "repite",
  "repetir",
];

const NUMEROS_EN_PALABRAS = new Set([
  "uno",
  "una",
  "un",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "medio",
  "media",
]);

type SegmentoAnalizado =
  | {
      tipo: "ok";
      cantidad: number;
      cantidadTexto: string;
      unidad: "kg" | "pieza" | null;
      producto: ProductoCatalogo;
      observaciones: string[];
      textoOriginal: string;
    }
  | { tipo: "falta_producto"; unidad: "kg" | "pieza" | null }
  | { tipo: "falta_cantidad"; producto: ProductoCatalogo }
  | { tipo: "no_interpretado"; segmento: string };

function requiereIa(texto: string): boolean {
  const normalizado = normalizarTextoPedido(texto);
  return FRASES_IA_FUTURA.some((frase) => normalizado.includes(frase));
}

function aclaracionCantidadSinProducto(unidad?: "kg" | "pieza" | null): string {
  if (unidad === "kg") {
    return "¿Qué producto necesita? Ejemplo: 5 kilos de costilla";
  }
  return "¿Qué producto necesita? Ejemplo: 2 capotes";
}

function aclaracionProductoSinCantidad(producto: ProductoCatalogo): string {
  if (producto.unidad === "kg") {
    return [
      `¿Cuántos kilos de ${producto.nombre} necesita?`,
      "",
      "Ejemplos: 5, 8.5",
    ].join("\n");
  }

  return [
    `¿Cuántas piezas de ${producto.nombre} necesita?`,
    "",
    "Ejemplos: 1, 2, 1.5",
  ].join("\n");
}

function aclaracionSegmentoNoInterpretado(segmento: string): string {
  return `No pude interpretar "${segmento}". Indique cantidad y producto. Ejemplo: 2 capotes`;
}

function detectarSoloCantidad(
  segmento: string
): { esSoloCantidad: true; unidad: "kg" | "pieza" | null } | { esSoloCantidad: false } {
  const normalizado = normalizarTextoPedido(segmento);
  if (!normalizado) return { esSoloCantidad: false };

  const conUnidad = normalizado.match(
    /^(\d+(?:[.,]\d+)?|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|medio|media)(?:\s+y\s+(medio|media))?\s+(kg|kilos?|kilo|piezas?|pz|pza)?$/
  );
  if (conUnidad) {
    const unidadToken = conUnidad[3]?.toLowerCase();
    const unidad =
      unidadToken && /^(kg|kilos?|kilo)$/.test(unidadToken)
        ? "kg"
        : unidadToken
          ? "pieza"
          : null;
    return { esSoloCantidad: true, unidad };
  }

  if (/^\d+(?:[.,]\d+)?$/.test(normalizado)) {
    return { esSoloCantidad: true, unidad: null };
  }

  if (NUMEROS_EN_PALABRAS.has(normalizado)) {
    return { esSoloCantidad: true, unidad: null };
  }

  if (/^(medio|media)$/.test(normalizado)) {
    return { esSoloCantidad: true, unidad: null };
  }

  if (
    /^(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+y\s+(medio|media)$/.test(
      normalizado
    )
  ) {
    return { esSoloCantidad: true, unidad: null };
  }

  return { esSoloCantidad: false };
}

function unidadParaProducto(
  producto: ProductoCatalogo,
  unidadExplicita: "kg" | "pieza" | null
): "kg" | "pieza" {
  if (unidadExplicita) return unidadExplicita;
  return producto.unidad === "kg" ? "kg" : "pieza";
}

/** Analiza un segmento extrayendo cantidad, producto, unidad y observaciones. */
function analizarSegmento(
  segmento: string,
  productos: ProductoCatalogo[]
): SegmentoAnalizado {
  const soloCantidad = detectarSoloCantidad(segmento);
  if (soloCantidad.esSoloCantidad) {
    return { tipo: "falta_producto", unidad: soloCantidad.unidad };
  }

  const limpio = limpiarPrefijoPedido(segmento);
  const { resto: textoObservaciones, observaciones } = extraerObservaciones(limpio);

  const parsed = parsearSegmentoPedido(textoObservaciones);
  if (parsed) {
    const resolucion = resolverProductoEnCatalogo(parsed.productoTexto, productos);
    if (resolucion.tipo === "ok") {
      return {
        tipo: "ok",
        cantidad: parsed.cantidad,
        cantidadTexto: parsed.cantidadTexto,
        unidad: parsed.unidad,
        producto: resolucion.producto,
        observaciones: [...observaciones, ...parsed.observaciones],
        textoOriginal: segmento,
      };
    }
  }

  const extraido = extraerCantidadYProducto(textoObservaciones, productos);
  if (extraido) {
    return {
      tipo: "ok",
      cantidad: extraido.cantidad,
      cantidadTexto: extraido.cantidadTexto,
      unidad: extraido.unidad,
      producto: extraido.producto,
      observaciones,
      textoOriginal: segmento,
    };
  }

  const productoSolo = pareceNombreProducto(textoObservaciones, productos);
  if (productoSolo) {
    return { tipo: "falta_cantidad", producto: productoSolo };
  }

  return { tipo: "no_interpretado", segmento };
}

export class ReglasSimplesInterpreter implements MensajeInterpreter {
  async interpretar(input: {
    texto: string;
    productos: ProductoCatalogo[];
  }): Promise<InterpretacionMensaje> {
    const texto = limpiarPrefijoPedido(input.texto.trim());

    if (!texto) {
      return { tipo: "no_interpretado", motivo: "Mensaje vacío." };
    }

    if (requiereIa(texto)) {
      return {
        tipo: "referencia_historica",
        motivo: "Requiere interpretación avanzada (fase IA).",
      };
    }

    const segmentos = segmentarMensajePedido(texto);
    const lineas: LineaInterpretada[] = [];
    const observaciones: string[] = [];

    for (const segmento of segmentos) {
      const analisis = analizarSegmento(segmento, input.productos);

      if (analisis.tipo === "falta_producto") {
        return {
          tipo: "no_interpretado",
          motivo: aclaracionCantidadSinProducto(analisis.unidad),
        };
      }

      if (analisis.tipo === "falta_cantidad") {
        return {
          tipo: "no_interpretado",
          motivo: aclaracionProductoSinCantidad(analisis.producto),
        };
      }

      if (analisis.tipo === "no_interpretado") {
        return {
          tipo: "no_interpretado",
          motivo: aclaracionSegmentoNoInterpretado(analisis.segmento),
        };
      }

      observaciones.push(...analisis.observaciones);

      lineas.push({
        producto_id: analisis.producto.id,
        cantidad: analisis.cantidad,
        unidad: unidadParaProducto(analisis.producto, analisis.unidad),
        textoOriginal: analisis.textoOriginal,
        cantidadTexto: analisis.cantidadTexto,
      });
    }

    if (lineas.length === 0) {
      return { tipo: "no_interpretado", motivo: aclaracionCantidadSinProducto() };
    }

    return {
      tipo: "pedido",
      lineas,
      observaciones: [...new Set(observaciones)],
    };
  }
}

export const interpretadorReglasSimples = new ReglasSimplesInterpreter();
