export const UNIDADES_CAPTURA_PEDIDO = ["kg", "pieza"] as const;

export type UnidadCapturaPedido = (typeof UNIDADES_CAPTURA_PEDIDO)[number];

export function esUnidadCapturaPedido(
  valor: string | null | undefined
): valor is UnidadCapturaPedido {
  return UNIDADES_CAPTURA_PEDIDO.includes(valor as UnidadCapturaPedido);
}

export function normalizarUnidadCaptura(
  unidad: string | null | undefined
): UnidadCapturaPedido {
  if (unidad === "kg") return "kg";
  return "pieza";
}

export function pasoCantidadPorUnidad(unidad: string): string {
  return unidad === "kg" ? "0.001" : "1";
}

export function minCantidadPorUnidad(unidad: string): string {
  return unidad === "kg" ? "0.001" : "1";
}

export const ETIQUETAS_MODO_CAPTURA: Record<UnidadCapturaPedido, string> = {
  kg: "Por kg",
  pieza: "Por pieza",
};

export function etiquetaModoCaptura(unidad: string): string {
  return ETIQUETAS_MODO_CAPTURA[normalizarUnidadCaptura(unidad)];
}

export function etiquetaCantidadModo(unidad: string): string {
  return normalizarUnidadCaptura(unidad) === "kg"
    ? "Cantidad (kg)"
    : "Cantidad (piezas)";
}
