export type TipoCalculoProducto =
  | "POR_KILO"
  | "POR_PESO_REAL"
  | "PRECIO_FIJO";

export const TIPOS_CALCULO: TipoCalculoProducto[] = [
  "POR_KILO",
  "POR_PESO_REAL",
  "PRECIO_FIJO",
];

export const ETIQUETAS_TIPO_CALCULO: Record<TipoCalculoProducto, string> = {
  POR_KILO: "Por kilo",
  POR_PESO_REAL: "Por peso real",
  PRECIO_FIJO: "Precio fijo",
};

export const DESCRIPCION_TIPO_CALCULO: Record<TipoCalculoProducto, string> = {
  POR_KILO: "Cantidad en kg × precio por kg",
  POR_PESO_REAL: "Pieza con peso capturado al preparar × precio por kg",
  PRECIO_FIJO: "Precio fijo sin depender del peso",
};

export function esTipoCalculoProducto(
  valor: string | null | undefined
): valor is TipoCalculoProducto {
  return TIPOS_CALCULO.includes(valor as TipoCalculoProducto);
}

export function tipoCalculoPorDefecto(unidad: string): TipoCalculoProducto {
  switch (unidad) {
    case "pieza":
      return "POR_PESO_REAL";
    case "paquete":
    case "caja":
      return "PRECIO_FIJO";
    default:
      return "POR_KILO";
  }
}
