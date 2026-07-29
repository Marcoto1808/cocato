import { redondearMoneda } from "@/lib/pedido-calculo";
import { normalizarUnidadCaptura } from "@/lib/pedido-unidades";

export function calcularSubtotalPreparacion(
  pesoRealKg: number | null,
  precioAplicado: number
): number {
  if (pesoRealKg === null || pesoRealKg <= 0 || precioAplicado < 0) {
    return 0;
  }

  return redondearMoneda(pesoRealKg * precioAplicado);
}

export function formatearCantidadSolicitada(
  cantidad: number,
  unidad: string,
  nombre: string,
  cantidadTexto?: string | null
): string {
  if (cantidadTexto?.trim()) {
    return `${cantidadTexto.trim()} · ${nombre}`;
  }

  const u = normalizarUnidadCaptura(unidad);

  if (u === "kg") {
    const texto = Number.isInteger(cantidad)
      ? String(cantidad)
      : String(cantidad);
    return `${texto} kg ${nombre}`;
  }

  const piezas = Number.isInteger(cantidad) ? cantidad : cantidad;
  const etiqueta = piezas === 1 ? "pieza" : "piezas";
  return `${piezas} ${etiqueta} · ${nombre}`;
}

export function etiquetaUnidadSolicitada(unidad: string): string {
  return normalizarUnidadCaptura(unidad) === "kg" ? "kg" : "piezas";
}

export function lineaPreparada(
  pesoRealKg: number | null,
  precioAplicado: number
): boolean {
  return (
    pesoRealKg !== null &&
    pesoRealKg > 0 &&
    precioAplicado >= 0 &&
    calcularSubtotalPreparacion(pesoRealKg, precioAplicado) > 0
  );
}
