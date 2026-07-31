export type OrigenPedidoColumna = "manual" | "whatsapp";

export type OrigenPedidoDisplay = OrigenPedidoColumna | "rapido";

export function resolverOrigenPedido(pedido: {
  origen?: string | null;
  mensaje_original?: string | null;
  cliente_nombre_temporal?: string | null;
}): OrigenPedidoDisplay {
  if (pedido.cliente_nombre_temporal?.trim()) {
    return "rapido";
  }

  if (pedido.origen === "whatsapp" || pedido.origen === "manual") {
    return pedido.origen;
  }

  return detectarOrigenLegacy(pedido.mensaje_original);
}

/** @deprecated Usar columna pedidos.origen; conservado para datos legacy. */
export function detectarOrigenPedido(
  mensajeOriginal: string | null | undefined
): OrigenPedidoDisplay {
  return detectarOrigenLegacy(mensajeOriginal);
}

function detectarOrigenLegacy(
  mensajeOriginal: string | null | undefined
): OrigenPedidoDisplay {
  const mensaje = mensajeOriginal?.trim().toLowerCase() ?? "";
  if (mensaje.startsWith("pedido rápido") || mensaje.startsWith("pedido rapido")) {
    return "rapido";
  }
  if (mensaje.startsWith("pedido manual")) {
    return "manual";
  }
  return "whatsapp";
}

export function etiquetaOrigenPedido(origen: OrigenPedidoDisplay): string {
  if (origen === "rapido") return "Pedido rápido";
  return origen === "manual" ? "Manual" : "WhatsApp";
}

export function iconoOrigenPedido(origen: OrigenPedidoColumna): string {
  return origen === "whatsapp" ? "📱" : "✍️";
}
