export type UnidadCaptura = "kg" | "pieza";

export function normalizarUnidadCaptura(unidad: string): UnidadCaptura {
  return unidad === "kg" ? "kg" : "pieza";
}

export type TipoCalculoProducto =
  | "POR_KILO"
  | "POR_PESO_REAL"
  | "PRECIO_FIJO";

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

export function redondearMoneda(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function normalizarPrecioAplicado(valor: number): number {
  if (Number.isNaN(valor)) return 0;
  return Math.max(0, Math.round(valor));
}

export function calcularSubtotalLineaCaptura(
  unidad: string,
  cantidad: number,
  precioAplicado: number,
  pesoTotalKg: number | null = null,
  cantidadEsTexto = false
): number {
  if (precioAplicado < 0) return 0;
  if (cantidadEsTexto) return 0;

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

export function formatMoneda(valor: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(valor);
}

export type LineaPedidoInsert = {
  producto_id: string;
  cantidad_solicitada: number;
  cantidad_texto: string | null;
  unidad: string;
  tipo_calculo: TipoCalculoProducto;
  peso_real: number | null;
  precio_lista: number;
  precio_aplicado: number;
  precio_modificado: boolean;
  subtotal: number;
};

export function crearLineaPedido(input: {
  producto_id: string;
  unidadProducto: string;
  tipo_calculo: TipoCalculoProducto;
  cantidad: number;
  unidadCaptura: UnidadCaptura;
  precioLista: number;
  cantidadTexto?: string | null;
}): LineaPedidoInsert {
  const cantidadEsTexto = Boolean(input.cantidadTexto?.trim());
  const precio_aplicado = normalizarPrecioAplicado(input.precioLista);
  const subtotal = calcularSubtotalLineaCaptura(
    input.unidadCaptura,
    input.cantidad,
    precio_aplicado,
    null,
    cantidadEsTexto
  );

  return {
    producto_id: input.producto_id,
    cantidad_solicitada: input.cantidad,
    cantidad_texto: input.cantidadTexto?.trim() || null,
    unidad: input.unidadCaptura,
    tipo_calculo: input.tipo_calculo,
    peso_real: null,
    precio_lista: input.precioLista,
    precio_aplicado,
    precio_modificado: false,
    subtotal,
  };
}
