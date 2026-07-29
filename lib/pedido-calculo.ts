import { normalizarUnidadCaptura } from "@/lib/pedido-unidades";

export function redondearMoneda(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Subtotal siempre con peso en kg: cantidad (kg) o peso total (piezas). */
export function calcularSubtotalLineaCaptura(
  unidad: string,
  cantidad: number,
  precioAplicado: number,
  pesoTotalKg: number | null = null
): number {
  if (precioAplicado < 0) {
    return 0;
  }

  if (normalizarUnidadCaptura(unidad) === "kg") {
    if (cantidad <= 0) return 0;
    return redondearMoneda(cantidad * precioAplicado);
  }

  if (pesoTotalKg !== null && pesoTotalKg > 0) {
    return redondearMoneda(pesoTotalKg * precioAplicado);
  }

  return 0;
}

export function calcularTotalLineas(lineas: { subtotal: number }[]): number {
  return redondearMoneda(
    lineas.reduce((total, linea) => total + linea.subtotal, 0)
  );
}

export function formatMoneda(valor: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(valor);
}

export function normalizarPrecioAplicado(valor: number): number {
  if (Number.isNaN(valor)) return 0;
  return Math.max(0, Math.round(valor));
}

export function subtotalPendientePeso(
  unidad: string,
  pesoTotalKg: number | null
): boolean {
  return (
    normalizarUnidadCaptura(unidad) === "pieza" &&
    (pesoTotalKg === null || pesoTotalKg <= 0)
  );
}

export function esPesoTotalEditable(unidad: string): boolean {
  return normalizarUnidadCaptura(unidad) === "pieza";
}

export function mostrarSubtotalLinea(
  unidad: string,
  subtotal: number,
  pesoTotalKg: number | null
): string | null {
  if (subtotalPendientePeso(unidad, pesoTotalKg)) {
    return null;
  }
  return formatMoneda(subtotal);
}

export function etiquetaCantidad(unidad: string): string {
  return normalizarUnidadCaptura(unidad) === "kg"
    ? "Cantidad (kg)"
    : "Cantidad (piezas)";
}
