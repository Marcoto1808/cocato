import {
  extraerProductoTextoCliente,
  segmentarMensajePedido,
} from "../openai/cantidad-natural.ts";
import {
  especieYaEspecificadaEnBusqueda,
  requiereDisambiguacionPorEspecie,
} from "../openai/disambiguacion.ts";

export type EspeciePreferida = "Res" | "Cerdo";

function sufijoEspecie(especie: EspeciePreferida): string {
  return especie === "Res" ? "de res" : "de cerdo";
}

function inyectarEspecieEnSegmento(
  segmento: string,
  especie: EspeciePreferida
): string {
  const limpio = segmento.trim();
  if (!limpio) return limpio;
  if (especieYaEspecificadaEnBusqueda(limpio)) return limpio;

  const producto = extraerProductoTextoCliente(limpio);
  if (!requiereDisambiguacionPorEspecie(producto)) return limpio;

  return `${limpio} ${sufijoEspecie(especie)}`.replace(/\s+/g, " ").trim();
}

export function aplicarEspeciePreferidaAlMensaje(
  mensaje: string,
  especie: EspeciePreferida
): string {
  const segmentos = segmentarMensajePedido(mensaje);
  if (segmentos.length === 0) {
    return inyectarEspecieEnSegmento(mensaje, especie);
  }

  return segmentos
    .map((segmento) => inyectarEspecieEnSegmento(segmento, especie))
    .join(", ");
}

export function combinarLineaConAclaracion(
  textoOriginal: string,
  aclaracion: string
): string {
  const original = textoOriginal.trim();
  const aclaracionLimpia = aclaracion.trim();
  if (!original || !aclaracionLimpia) return original;

  if (especieYaEspecificadaEnBusqueda(aclaracionLimpia)) {
    const productoOriginal = extraerProductoTextoCliente(original);
    const stem = productoOriginal.split(/\s+/)[0] ?? productoOriginal;
    if (original.toLowerCase().includes(stem.toLowerCase())) {
      const especie =
        /\b(de\s+)?(cerdo|puerco|cochino|chancho)\b/i.test(aclaracionLimpia)
          ? "de cerdo"
          : "de res";
      const sinEspecie = original.replace(
        /\s+de\s+(res|cerdo|puerco|cochino|chancho|carne de res)\b.*$/i,
        ""
      );
      return `${sinEspecie} ${especie}`.replace(/\s+/g, " ").trim();
    }
  }

  const productoOriginal = extraerProductoTextoCliente(original);
  if (
    productoOriginal &&
    aclaracionLimpia.toLowerCase().includes(productoOriginal.toLowerCase())
  ) {
    return original.replace(
      new RegExp(productoOriginal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      aclaracionLimpia
    );
  }

  return `${original} ${aclaracionLimpia}`.replace(/\s+/g, " ").trim();
}
