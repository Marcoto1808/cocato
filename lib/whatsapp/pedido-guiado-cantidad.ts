import {
  limpiarPrefijoPedido,
  normalizarExpresionesCantidad,
  normalizarTextoPedido,
  parsearSegmentoPedido,
} from "@/lib/interpretacion/cantidad-natural";
import type { LineaCarrito } from "@/lib/whatsapp/conversation-cart";
import {
  esCantidadImporte,
  importeFijoDesdeCantidad,
} from "@/lib/pedido-cantidad";

export type CantidadGuiadaParseada = {
  cantidad: number;
  unidad: "kg" | "pieza";
  cantidadTexto?: string;
  textoOriginal: string;
};

/** Número(s) de menú vs. descripción libre: "2 capotes" lleva texto → no es índice. */
export function mensajeContieneTextoProducto(texto: string): boolean {
  return /\p{L}/u.test(texto.normalize("NFD").replace(/\p{M}/gu, ""));
}

/** Selección múltiple: "1 2 4" o "124" → [1, 2, 4] */
export function parsearSeleccionesMultiples(
  texto: string,
  max: number
): number[] | null {
  const limpio = texto.trim().replace(/[,;]+/g, " ").trim();
  if (!limpio || max < 1) return null;

  if (mensajeContieneTextoProducto(limpio)) return null;

  if (/^\d+$/.test(limpio)) {
    const comoNumero = Number(limpio);
    if (
      Number.isInteger(comoNumero) &&
      comoNumero >= 1 &&
      comoNumero <= max
    ) {
      return [comoNumero];
    }

    return parsearDigitosConcatenados(limpio, max);
  }

  const numeros = limpio.match(/\d+/g);
  if (!numeros?.length) return null;

  const seleccionados: number[] = [];
  const vistos = new Set<number>();

  for (const token of numeros) {
    const valor = Number(token);
    if (!Number.isInteger(valor) || valor < 1 || valor > max) return null;
    if (vistos.has(valor)) continue;
    vistos.add(valor);
    seleccionados.push(valor);
  }

  return seleccionados.length > 0 ? seleccionados : null;
}

function parsearDigitosConcatenados(texto: string, max: number): number[] | null {
  const seleccionados: number[] = [];
  const vistos = new Set<number>();

  for (const char of texto) {
    const valor = Number(char);
    if (!Number.isInteger(valor) || valor < 1 || valor > max) return null;
    if (vistos.has(valor)) continue;
    vistos.add(valor);
    seleccionados.push(valor);
  }

  return seleccionados.length > 0 ? seleccionados : null;
}

function esImporteExplicito(texto: string): boolean {
  const limpio = texto.trim();
  return limpio.includes("$") || /\bpesos?\b/i.test(limpio);
}

function parsearImporteGuiado(texto: string): CantidadGuiadaParseada | null {
  const limpio = texto.trim();
  if (!esImporteExplicito(limpio)) return null;

  const match = limpio.match(/^\$?\s*(\d+(?:[.,]\d+)?)\s*(?:pesos?)?\s*$/i);
  if (!match) return null;

  const valor = Number(match[1].replace(",", "."));
  if (!Number.isFinite(valor) || valor <= 0) return null;

  const cantidadTexto = limpio.includes("$")
    ? `$${valor}`
    : `${valor} pesos`;

  return {
    cantidad: 1,
    unidad: "pieza",
    cantidadTexto,
    textoOriginal: limpio,
  };
}

function parsearNumeroSoloPiezas(texto: string): CantidadGuiadaParseada | null {
  const normalizado = texto.trim().replace(",", ".");
  const match = normalizado.match(/^(\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const cantidad = Number(match[1]);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null;

  const cantidadTexto =
    cantidad === 1 ? "1 pieza" : `${cantidad} piezas`;

  return {
    cantidad,
    unidad: "pieza",
    cantidadTexto,
    textoOriginal: texto.trim(),
  };
}

function quitarNombreProducto(texto: string, productoNombre?: string): string {
  if (!productoNombre?.trim()) return texto;

  const normalizado = normalizarTextoPedido(texto);
  const producto = normalizarTextoPedido(productoNombre);
  if (!normalizado.includes(producto)) return texto;

  const regex = new RegExp(
    `\\b(?:de\\s+)?${producto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`,
    "i"
  );
  return texto.replace(regex, "").replace(/\s+/g, " ").trim();
}

function cantidadTextoDesdeSegmento(input: {
  cantidad: number;
  unidad: "kg" | "pieza" | null;
  cantidadTexto: string;
}): string | undefined {
  if (esCantidadImporte(input.cantidadTexto)) {
    return input.cantidadTexto;
  }

  if (input.unidad === "kg") {
    if (/\bkg\b/i.test(input.cantidadTexto)) return input.cantidadTexto.trim();
    return `${input.cantidad} kg`;
  }

  if (/\bpieza/i.test(input.cantidadTexto)) return input.cantidadTexto.trim();
  if (input.cantidad === 1) return "1 pieza";
  return `${input.cantidad} piezas`;
}

/**
 * Interpreta cantidad en pedido guiado.
 * Número solo → piezas. $200 / 200 pesos → importe. kg/piezas naturales conservados.
 */
export function parsearCantidadPedidoGuiado(
  texto: string,
  productoNombre?: string
): CantidadGuiadaParseada | null {
  const limpio = quitarNombreProducto(texto.trim(), productoNombre);
  if (!limpio) return null;

  const importe = parsearImporteGuiado(limpio);
  if (importe) return importe;

  const soloNumero = parsearNumeroSoloPiezas(limpio);
  if (soloNumero) return soloNumero;

  const preparado = normalizarExpresionesCantidad(limpiarPrefijoPedido(limpio));
  const segmento = parsearSegmentoPedido(
    productoNombre
      ? `${preparado} de ${productoNombre}`
      : `${preparado} de producto`
  );

  if (!segmento || segmento.cantidad <= 0) return null;

  if (esCantidadImporte(segmento.cantidadTexto)) {
    return {
      cantidad: 1,
      unidad: "pieza",
      cantidadTexto: segmento.cantidadTexto,
      textoOriginal: limpio,
    };
  }

  const unidad = segmento.unidad === "kg" ? "kg" : "pieza";
  return {
    cantidad: segmento.cantidad,
    unidad,
    cantidadTexto: cantidadTextoDesdeSegmento({
      cantidad: segmento.cantidad,
      unidad: segmento.unidad,
      cantidadTexto: segmento.cantidadTexto,
    }),
    textoOriginal: limpio,
  };
}

export function articuloCantidad(productoNombre: string): "Cuánto" | "Cuánta" {
  const normalizado = normalizarTextoPedido(productoNombre);
  const femeninos = [
    "pierna",
    "costilla",
    "milanesa",
    "chuleta",
    "espaldilla",
    "manitas",
    "molida",
    "maciza",
    "pulpa",
    "cabeza",
  ];
  return femeninos.some((palabra) => normalizado.startsWith(palabra))
    ? "Cuánta"
    : "Cuánto";
}

export function construirPreguntaCantidadGuiada(
  productoNombre: string,
  mostrarEjemplos: boolean
): string {
  const pregunta = `${articuloCantidad(productoNombre)} ${productoNombre} necesita?`;

  if (!mostrarEjemplos) {
    return `¿${pregunta}`;
  }

  return [
    `¿${pregunta}`,
    "",
    "Puede escribir, por ejemplo: 3 kilos, 2 piezas o $200",
  ].join("\n");
}

export function construirConfirmacionSeleccionGuiada(
  etiquetas: string[]
): string {
  const lista = etiquetas.map((etiqueta) => `- ${etiqueta}`).join("\n");
  return [
    "Perfecto. Seleccionaste:",
    "",
    lista,
    "",
    "Vamos uno por uno.",
  ].join("\n");
}

export function construirErrorCantidadGuiada(
  productoNombre: string,
  indice: number
): string {
  const pregunta = construirPreguntaCantidadGuiada(
    productoNombre,
    indice === 0
  );

  return [
    "No pude identificar la cantidad.",
    "",
    "Puedes escribir, por ejemplo: 3 kilos, 2 piezas o $200.",
    "",
    pregunta,
  ].join("\n");
}

export function formatearLineaResumenGuiado(linea: {
  producto_nombre: string;
  cantidad: number;
  unidad: "kg" | "pieza";
  cantidadTexto?: string;
}): string {
  if (linea.cantidadTexto && esCantidadImporte(linea.cantidadTexto)) {
    const importe = importeFijoDesdeCantidad(linea.cantidadTexto);
    const monto =
      importe != null ? `$${importe}` : linea.cantidadTexto.trim();
    return `• ${monto} de ${linea.producto_nombre}`;
  }

  if (linea.unidad === "kg") {
    const display =
      linea.cantidadTexto?.trim().match(/\b(kg|kilo)/i)
        ? linea.cantidadTexto.trim()
        : `${linea.cantidad} kg`;
    return `• ${display} de ${linea.producto_nombre}`;
  }

  const display =
    linea.cantidadTexto?.trim() ||
    (linea.cantidad === 1 ? "1 pieza" : `${linea.cantidad} piezas`);
  return `• ${display} de ${linea.producto_nombre}`;
}

export function construirResumenPedidoGuiado(lineas: LineaCarrito[]): string {
  return lineas.map((linea) => formatearLineaResumenGuiado(linea)).join("\n");
}

export function construirMensajePostPedidoGuiado(resumen: string): string {
  return [
    "Su pedido:",
    "",
    resumen,
    "",
    "¿Qué desea hacer?",
    "",
    "1. Confirmar pedido",
    "2. Agregar algo más",
    "3. Empezar de nuevo",
  ].join("\n");
}

export function construirRespuestaPostPedidoGuiadoInvalida(
  resumen: string
): string {
  return [
    "No entendí su respuesta.",
    "",
    construirMensajePostPedidoGuiado(resumen),
  ].join("\n");
}

export function construirMenuProductosGuiados(
  especie: "Res" | "Cerdo",
  productos: Array<{ nombre: string }>
): string {
  const emoji = especie === "Res" ? "🥩" : "🐖";
  const titulo = especie === "Res" ? "Productos de res" : "Productos de cerdo";
  const lineas = productos.map(
    (producto, indice) => `${indice + 1}. ${producto.nombre}`
  );

  return [
    `${emoji} ${titulo}:`,
    "",
    ...lineas,
    "",
    "Elija el número del producto que desea.",
    "Puede elegir uno o varios, por ejemplo: 1 2 4.",
    "",
    "¿No encuentra el producto que busca?",
    "No se preocupe, escríbalo con su nombre y lo agregaremos a su pedido.",
    "",
    "Escribe *menu* para volver al inicio.",
  ].join("\n");
}
