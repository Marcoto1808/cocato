export type ProductoPedidoJoin = {
  nombre: string;
  precio_kg: number;
  unidad: string;
};

export type LineaPedido = {
  id: string;
  producto_id: string;
  cantidad_solicitada: number;
  unidad: string;
  peso_real: number | null;
  precio_kg: number;
  subtotal: number;
  productos: ProductoPedidoJoin | ProductoPedidoJoin[] | null;
};

export function resolverProductoPedido(
  productos: ProductoPedidoJoin | ProductoPedidoJoin[] | null | undefined
): ProductoPedidoJoin | null {
  if (!productos) return null;
  return Array.isArray(productos) ? (productos[0] ?? null) : productos;
}

export function precioKgLinea(linea: LineaPedido): number {
  const producto = resolverProductoPedido(linea.productos);
  return producto?.precio_kg ?? linea.precio_kg ?? 0;
}

export function calcularSubtotalLinea(
  pesoReal: number | null,
  cantidadSolicitada: number,
  unidad: string,
  precioKg: number
): number {
  const peso =
    pesoReal ?? (unidad === "kg" ? cantidadSolicitada : null);

  if (peso === null || peso <= 0 || precioKg <= 0) {
    return 0;
  }

  return Math.round(peso * precioKg * 100) / 100;
}

export function calcularTotalPedido(lineas: LineaPedido[]): number {
  return lineas.reduce((total, linea) => {
    const precioKg = precioKgLinea(linea);
    return (
      total +
      calcularSubtotalLinea(
        linea.peso_real,
        linea.cantidad_solicitada,
        linea.unidad,
        precioKg
      )
    );
  }, 0);
}

export function formatMoneda(valor: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(valor);
}
