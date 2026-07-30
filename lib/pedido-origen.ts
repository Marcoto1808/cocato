export type OrigenPedido = "manual" | "whatsapp" | "rapido";

export function detectarOrigenPedido(
  mensajeOriginal: string | null | undefined
): OrigenPedido {
  const mensaje = mensajeOriginal?.trim().toLowerCase() ?? "";
  if (mensaje.startsWith("pedido rápido") || mensaje.startsWith("pedido rapido")) {
    return "rapido";
  }
  if (mensaje.startsWith("pedido manual")) {
    return "manual";
  }
  return "whatsapp";
}

export function etiquetaOrigenPedido(origen: OrigenPedido): string {
  if (origen === "rapido") return "Pedido rápido";
  return origen === "manual" ? "Manual" : "WhatsApp";
}
