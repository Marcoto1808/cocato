import type {
  InterpretacionMensaje,
  LineaInterpretada,
  ProductoCatalogo,
} from "@/lib/interpretacion/mensaje-interpreter";
import {
  extraerObservaciones,
  extraerProductoTextoCliente,
  inferirUnidadExplicitaDesdeSegmento,
  limpiarPrefijoPedido,
  normalizarCantidadTextoParaDisplay,
  normalizarTextoPedido,
  parsearSegmentoPedido,
  segmentarMensajePedido,
} from "@/lib/interpretacion/cantidad-natural";
import {
  construirMensajeDisambiguacion,
  extraerProductoBuscado,
  lineaPendienteDesdeAmbiguo,
  procesarResolucionAmbigua,
  type DisambiguacionPendiente,
} from "@/lib/interpretacion/disambiguacion";
import {
  PRODUCTO_LINEA_LIBRE_ID,
} from "@/lib/interpretacion/linea-libre";
import {
  pareceNombreProducto,
  resolverProductoEnCatalogo,
  separarCantidadInicial,
  type ContextoResolucionProducto,
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

/** Montos menores se interpretan como cantidad (piezas), no como pesos. */
const IMPORTE_MINIMO_SIN_PESOS = 20;

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
  | {
      tipo: "ambiguo";
      cantidad: number;
      cantidadTexto: string;
      unidad: "kg" | "pieza" | null;
      opciones: ProductoCatalogo[];
      segmento: string;
    }
  | { tipo: "falta_producto"; unidad: "kg" | "pieza" | null; segmento: string }
  | { tipo: "falta_cantidad"; producto: ProductoCatalogo; segmento: string }
  | { tipo: "producto_no_encontrado"; productoTexto: string; segmento: string }
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
  return `No entendí "${segmento}".`;
}

function aclaracionProductoNoEncontrado(productoTexto: string): string {
  return `No encontré el producto "${productoTexto}".`;
}

function aclaracionDesdeDisambiguacion(
  analisis: Extract<SegmentoAnalizado, { tipo: "ambiguo" }>
): string {
  const productoBuscado = extraerProductoBuscado(analisis.segmento);
  return construirMensajeDisambiguacion(
    analisis.opciones.map((producto) => ({
      id: producto.id,
      nombre: producto.nombre,
      categoria: producto.categoria,
    })),
    productoBuscado
  );
}

function motivoDesdeAnalisis(analisis: Exclude<SegmentoAnalizado, { tipo: "ok" }>): string {
  if (analisis.tipo === "ambiguo") {
    return aclaracionDesdeDisambiguacion(analisis);
  }
  if (analisis.tipo === "falta_producto") {
    return aclaracionCantidadSinProducto(analisis.unidad);
  }
  if (analisis.tipo === "falta_cantidad") {
    return aclaracionProductoSinCantidad(analisis.producto);
  }
  if (analisis.tipo === "producto_no_encontrado") {
    return aclaracionProductoNoEncontrado(analisis.productoTexto);
  }
  return aclaracionSegmentoNoInterpretado(analisis.segmento);
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
  _producto: ProductoCatalogo,
  unidadExplicita: "kg" | "pieza" | null
): "kg" | "pieza" {
  if (unidadExplicita) return unidadExplicita;
  return "pieza";
}

function completarPresentacionLinea(input: {
  segmento: string;
  cantidad: number;
  cantidadTexto: string;
  unidad: "kg" | "pieza" | null;
  nombreMostrar?: string;
}): {
  cantidadTexto: string;
  unidad: "kg" | "pieza";
  nombreMostrar?: string;
} {
  const unidadExplicita = inferirUnidadExplicitaDesdeSegmento(input.segmento);
  const unidad: "kg" | "pieza" =
    unidadExplicita ?? input.unidad ?? "pieza";

  return {
    unidad,
    cantidadTexto: normalizarCantidadTextoParaDisplay({
      cantidad: input.cantidad,
      unidad,
      cantidadTexto: input.cantidadTexto,
      segmento: input.segmento,
    }),
    nombreMostrar:
      input.nombreMostrar ?? extraerProductoTextoCliente(input.segmento),
  };
}

function pareceImporteSinUnidad(importe: number, texto: string): boolean {
  if (!Number.isFinite(importe) || importe < IMPORTE_MINIMO_SIN_PESOS) {
    return false;
  }

  const normalizado = normalizarTextoPedido(texto);
  if (/\b(kg|kilos?|kilo|piezas?|pz|pza)\b/.test(normalizado)) {
    return false;
  }

  return true;
}

function parsearSegmentoImporte(texto: string): {
  cantidadTexto: string;
  productoTexto: string;
} | null {
  const limpio = texto.trim();

  const conSimbolo = limpio.match(/^\$\s*(\d+(?:[.,]\d+)?)\s*(?:de\s+)?(.+)$/i);
  if (conSimbolo) {
    const importe = Number(conSimbolo[1].replace(",", "."));
    const productoTexto = conSimbolo[2]?.trim();
    if (!Number.isFinite(importe) || importe <= 0 || !productoTexto) return null;

    return {
      cantidadTexto: `$${conSimbolo[1]}`,
      productoTexto,
    };
  }

  const conPesos = limpio.match(/^(\d+(?:[.,]\d+)?)\s*pesos?\s+(?:de\s+)?(.+)$/i);
  if (conPesos) {
    const importe = Number(conPesos[1].replace(",", "."));
    const productoTexto = conPesos[2]?.trim();
    if (!Number.isFinite(importe) || importe <= 0 || !productoTexto) return null;

    return {
      cantidadTexto: `${conPesos[1]} pesos`,
      productoTexto,
    };
  }

  const sinPesos = limpio.match(/^(\d+(?:[.,]\d+)?)\s+de\s+(.+)$/i);
  if (sinPesos) {
    const importe = Number(sinPesos[1].replace(",", "."));
    const productoTexto = sinPesos[2]?.trim();
    if (
      !Number.isFinite(importe) ||
      importe <= 0 ||
      !productoTexto ||
      !pareceImporteSinUnidad(importe, limpio)
    ) {
      return null;
    }

    return {
      cantidadTexto: `${sinPesos[1]} pesos`,
      productoTexto,
    };
  }

  return null;
}

function segmentoAmbiguo(input: {
  segmento: string;
  cantidad: number;
  cantidadTexto: string;
  unidad: "kg" | "pieza" | null;
  opciones: ProductoCatalogo[];
}): SegmentoAnalizado {
  return {
    tipo: "ambiguo",
    cantidad: input.cantidad,
    cantidadTexto: input.cantidadTexto,
    unidad: input.unidad,
    opciones: input.opciones,
    segmento: input.segmento,
  };
}

function aplicarReglasDisambiguacion(input: {
  segmento: string;
  cantidad: number;
  cantidadTexto: string;
  unidad: "kg" | "pieza" | null;
  observaciones: string[];
  opciones: ProductoCatalogo[];
  nombreBuscado?: string;
}): SegmentoAnalizado {
  const procesada = procesarResolucionAmbigua({
    nombreBuscado:
      input.nombreBuscado?.trim() ||
      extraerProductoBuscado(input.segmento) ||
      input.segmento,
    opciones: input.opciones,
  });

  if (procesada.tipo === "ok") {
    return {
      tipo: "ok",
      cantidad: input.cantidad,
      cantidadTexto: input.cantidadTexto,
      unidad: input.unidad,
      producto: procesada.producto,
      observaciones: input.observaciones,
      textoOriginal: input.segmento,
    };
  }

  return segmentoAmbiguo({
    segmento: input.segmento,
    cantidad: input.cantidad,
    cantidadTexto: input.cantidadTexto,
    unidad: input.unidad,
    opciones: procesada.opciones,
  });
}

function resolucionComoSegmento(input: {
  segmento: string;
  cantidad: number;
  cantidadTexto: string;
  unidad: "kg" | "pieza" | null;
  observaciones: string[];
  resolucion: ReturnType<typeof resolverProductoEnCatalogo>;
}): SegmentoAnalizado | null {
  if (input.resolucion.tipo === "ok") {
    return {
      tipo: "ok",
      cantidad: input.cantidad,
      cantidadTexto: input.cantidadTexto,
      unidad: input.unidad,
      producto: input.resolucion.producto,
      observaciones: input.observaciones,
      textoOriginal: input.segmento,
    };
  }

  if (input.resolucion.tipo === "ambiguo") {
    return aplicarReglasDisambiguacion({
      segmento: input.segmento,
      cantidad: input.cantidad,
      cantidadTexto: input.cantidadTexto,
      unidad: input.unidad,
      observaciones: input.observaciones,
      opciones: input.resolucion.opciones,
    });
  }

  return null;
}

function intentoParseoProducto(texto: string): { productoTexto: string } | null {
  const importe = parsearSegmentoImporte(texto);
  if (importe) return { productoTexto: importe.productoTexto };

  const parsed = parsearSegmentoPedido(texto);
  if (parsed) return { productoTexto: parsed.productoTexto };

  const separado = separarCantidadInicial(texto);
  if (separado?.resto) return { productoTexto: separado.resto };

  return null;
}

function analizarSegmento(
  segmento: string,
  productos: ProductoCatalogo[],
  contexto?: ContextoResolucionProducto
): SegmentoAnalizado {
  const soloCantidad = detectarSoloCantidad(segmento);
  if (soloCantidad.esSoloCantidad) {
    return {
      tipo: "falta_producto",
      unidad: soloCantidad.unidad,
      segmento,
    };
  }

  const limpio = limpiarPrefijoPedido(segmento);
  const { resto: textoObservaciones, observaciones } = extraerObservaciones(limpio);

  const importe = parsearSegmentoImporte(textoObservaciones);
  if (importe) {
    const resolucion = resolverProductoEnCatalogo(
      importe.productoTexto,
      productos,
      contexto
    );
    const interpretado = resolucionComoSegmento({
      segmento,
      cantidad: 1,
      cantidadTexto: importe.cantidadTexto,
      unidad: null,
      observaciones,
      resolucion,
    });
    if (interpretado) return interpretado;
  }

  const parsed = parsearSegmentoPedido(textoObservaciones);
  if (parsed) {
    const resolucion = resolverProductoEnCatalogo(
      parsed.productoTexto,
      productos,
      contexto
    );
    const interpretado = resolucionComoSegmento({
      segmento,
      cantidad: parsed.cantidad,
      cantidadTexto: parsed.cantidadTexto,
      unidad: parsed.unidad,
      observaciones: [...observaciones, ...parsed.observaciones],
      resolucion,
    });
    if (interpretado) return interpretado;
  }

  const separado = separarCantidadInicial(textoObservaciones);
  if (separado) {
    const resolucion = resolverProductoEnCatalogo(separado.resto, productos, contexto);
    const interpretado = resolucionComoSegmento({
      segmento,
      cantidad: separado.cantidad,
      cantidadTexto: separado.cantidadTexto,
      unidad: separado.unidad,
      observaciones,
      resolucion,
    });
    if (interpretado) return interpretado;
  }

  const resolucionSoloProducto = resolverProductoEnCatalogo(
    textoObservaciones,
    productos,
    contexto
  );
  if (resolucionSoloProducto.tipo === "ambiguo") {
    return aplicarReglasDisambiguacion({
      segmento,
      cantidad: 0,
      cantidadTexto: "",
      unidad: null,
      observaciones,
      opciones: resolucionSoloProducto.opciones,
      nombreBuscado: textoObservaciones,
    });
  }

  const productoSolo = pareceNombreProducto(textoObservaciones, productos, contexto);
  if (productoSolo) {
    return { tipo: "falta_cantidad", producto: productoSolo, segmento };
  }

  const intento = intentoParseoProducto(textoObservaciones);
  if (intento) {
    return {
      tipo: "producto_no_encontrado",
      productoTexto: intento.productoTexto,
      segmento,
    };
  }

  return { tipo: "no_interpretado", segmento };
}

function lineaLibreDesdeSegmento(segmento: string): LineaInterpretada {
  const limpio = limpiarPrefijoPedido(segmento.trim());
  const { resto: textoObservaciones } = extraerObservaciones(limpio);

  const importe = parsearSegmentoImporte(textoObservaciones);
  if (importe) {
    return {
      producto_id: PRODUCTO_LINEA_LIBRE_ID,
      cantidad: 1,
      unidad: "pieza",
      textoOriginal: segmento,
      cantidadTexto: importe.cantidadTexto,
      nombreMostrar: importe.productoTexto,
    };
  }

  const parsed = parsearSegmentoPedido(textoObservaciones);
  if (parsed) {
    return {
      producto_id: PRODUCTO_LINEA_LIBRE_ID,
      cantidad: parsed.cantidad,
      unidad: parsed.unidad ?? "pieza",
      textoOriginal: segmento,
      cantidadTexto: parsed.cantidadTexto,
      nombreMostrar: parsed.productoTexto,
    };
  }

  const separado = separarCantidadInicial(textoObservaciones);
  if (separado) {
    return {
      producto_id: PRODUCTO_LINEA_LIBRE_ID,
      cantidad: separado.cantidad,
      unidad: separado.unidad ?? "pieza",
      textoOriginal: segmento,
      cantidadTexto: separado.cantidadTexto,
      nombreMostrar: separado.resto,
    };
  }

  return {
    producto_id: PRODUCTO_LINEA_LIBRE_ID,
    cantidad: 1,
    unidad: "pieza",
    textoOriginal: segmento,
    nombreMostrar: textoObservaciones || limpio,
  };
}
function disambiguacionDesdeAnalisis(
  analisis: Extract<SegmentoAnalizado, { tipo: "ambiguo" }>
): DisambiguacionPendiente {
  return {
    segmento: analisis.segmento,
    cantidad: analisis.cantidad,
    cantidadTexto: analisis.cantidadTexto,
    unidad: analisis.unidad,
    productoBuscado: extraerProductoBuscado(analisis.segmento),
    opciones: analisis.opciones.map((producto) => ({
      id: producto.id,
      nombre: producto.nombre,
      categoria: producto.categoria,
    })),
  };
}

/** Motor unificado de interpretación comercial para mensajes de pedido. */
export function interpretarMensajeComercial(input: {
  texto: string;
  productos: ProductoCatalogo[];
  categoriaContexto?: string | null;
}): InterpretacionMensaje {
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
  const ambiguos: Extract<SegmentoAnalizado, { tipo: "ambiguo" }>[] = [];

  for (const segmento of segmentos) {
    const analisis = analizarSegmento(segmento, input.productos);

    if (analisis.tipo === "ok") {
      observaciones.push(...analisis.observaciones);
      const presentacion = completarPresentacionLinea({
        segmento: analisis.textoOriginal,
        cantidad: analisis.cantidad,
        cantidadTexto: analisis.cantidadTexto,
        unidad: analisis.unidad,
      });
      lineas.push({
        producto_id: analisis.producto.id,
        cantidad: analisis.cantidad,
        unidad: presentacion.unidad,
        textoOriginal: analisis.textoOriginal,
        cantidadTexto: presentacion.cantidadTexto,
      });
      continue;
    }

    if (analisis.tipo === "ambiguo") {
      lineas.push(
        lineaPendienteDesdeAmbiguo({
          segmento: analisis.segmento,
          cantidad: analisis.cantidad,
          cantidadTexto: analisis.cantidadTexto,
          unidad: analisis.unidad,
        })
      );
      ambiguos.push(analisis);
      continue;
    }

    lineas.push(lineaLibreDesdeSegmento(segmento));
  }

  if (lineas.length === 0 && ambiguos.length === 0) {
    return {
      tipo: "no_interpretado",
      motivo: aclaracionCantidadSinProducto(),
    };
  }

  if (ambiguos.length > 0) {
    const [primero, ...cola] = ambiguos;
    return {
      tipo: "pedido",
      lineas,
      observaciones: [...new Set(observaciones)],
      aclaracion: aclaracionDesdeDisambiguacion(primero),
      disambiguacion: {
        ...disambiguacionDesdeAnalisis(primero),
        mensajeOriginal: texto,
        cola: cola.map(disambiguacionDesdeAnalisis),
      },
    };
  }

  return {
    tipo: "pedido",
    lineas,
    observaciones: [...new Set(observaciones)],
  };
}

export {
  analizarSegmento,
  parsearSegmentoImporte,
  aclaracionSegmentoNoInterpretado,
  aclaracionProductoNoEncontrado,
  IMPORTE_MINIMO_SIN_PESOS,
};
