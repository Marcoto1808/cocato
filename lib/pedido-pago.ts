import { esPedidoEntregado } from "@/lib/pedido-estados";

export type EstadoPago = "pendiente" | "pagado";

export const ESTADO_PAGO_AL_ENTREGAR: EstadoPago = "pendiente";

export function normalizarEstadoPago(
  valor: string | null | undefined
): EstadoPago | null {
  if (!valor) return null;
  const normalizado = valor.toLowerCase().trim();
  if (normalizado === "pagado") return "pagado";
  if (normalizado === "pendiente") return "pendiente";
  return null;
}

/** Entregado y sin marcar como pagado (incluye registros legacy sin estado_pago). */
export function esNotaPendientePago(pedido: {
  estado: string;
  estado_pago: string | null;
}): boolean {
  if (!esPedidoEntregado(pedido.estado)) return false;
  return normalizarEstadoPago(pedido.estado_pago) !== "pagado";
}

export function etiquetaEstadoPago(estado: string | null): string {
  const normalizado = normalizarEstadoPago(estado);
  if (normalizado === "pagado") return "🟢 Pagado";
  if (normalizado === "pendiente") return "🔴 Pendiente";
  return "—";
}

export function puedeRegistrarPago(pedido: {
  estado: string;
  estado_pago: string | null;
}): boolean {
  return esNotaPendientePago(pedido);
}
