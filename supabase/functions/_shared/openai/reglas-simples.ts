import type { AnalisisPedidoIA, LineaExtraidaIA } from "./extract-pedido.ts";
import {
  buscarProductoPorNombre,
  type ProductoCatalogo,
} from "../repositories/product.repository.ts";

const FRASES_IA = [
  "lo de siempre",
  "lo mismo",
  "igual que ayer",
  "como siempre",
  "como ayer",
  "mismo pedido",
  "repite",
  "repetir",
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

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function segmentarMensaje(texto: string): string[] {
  return texto
    .split(/[\n,;]+|\s+y\s+/i)
    .map((parte) => parte.trim())
    .filter(Boolean);
}

function parsearSegmento(segmento: string): {
  cantidad: number;
  unidad: "kg" | "pieza" | null;
  resto: string;
} | null {
  const match = segmento.trim().match(
    /^(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kilo|piezas?|pz|pza|paquetes?|cajas?)?\s*(.+)$/i
  );

  if (!match) return null;

  const cantidad = Number(match[1].replace(",", "."));
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null;

  const unidadToken = match[2]?.toLowerCase() ?? null;
  let unidad: "kg" | "pieza" | null = null;

  if (unidadToken) {
    if (UNIDADES_KG.has(unidadToken)) unidad = "kg";
    else if (UNIDADES_PIEZA.has(unidadToken)) unidad = "pieza";
  }

  return { cantidad, unidad, resto: match[3].trim() };
}

function unidadParaProducto(
  producto: ProductoCatalogo,
  unidadExplicita: "kg" | "pieza" | null
): "kg" | "pieza" {
  if (unidadExplicita) return unidadExplicita;
  return producto.unidad === "kg" ? "kg" : "pieza";
}

/** Interpretación determinística para mensajes simples (ej. "5 costillas"). */
export function interpretarMensajeSimple(input: {
  mensaje: string;
  productos: ProductoCatalogo[];
  nombreCliente: string;
}): AnalisisPedidoIA | null {
  const texto = input.mensaje.trim();
  if (!texto) return null;

  const normalizado = normalizarTexto(texto);
  if (FRASES_IA.some((frase) => normalizado.includes(frase))) {
    return null;
  }

  const lineas: LineaExtraidaIA[] = [];

  for (const segmento of segmentarMensaje(texto)) {
    const parsed = parsearSegmento(segmento);
    if (!parsed) return null;

    const producto = buscarProductoPorNombre(parsed.resto, input.productos);
    if (!producto) return null;

    lineas.push({
      producto_nombre: producto.nombre,
      cantidad: parsed.cantidad,
      unidad: unidadParaProducto(producto, parsed.unidad),
    });
  }

  if (lineas.length === 0) return null;

  const resumen = lineas
    .map((l) => `${l.cantidad} ${l.unidad === "kg" ? "kg" : "pza"} ${l.producto_nombre}`)
    .join(", ");

  return {
    es_pedido: true,
    lineas,
    observaciones: null,
    respuesta_cliente: `Hola ${input.nombreCliente}. Registré tu pedido: ${resumen}. Gracias.`,
    motivo_no_pedido: null,
  };
}
