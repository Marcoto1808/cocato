export type OrigenPedido = "manual" | "whatsapp";

export function detectarOrigenPedido(
  mensajeOriginal: string | null | undefined
): OrigenPedido {
  const mensaje = mensajeOriginal?.trim().toLowerCase() ?? "";
  if (mensaje.startsWith("pedido manual")) {
    return "manual";
  }
  return "whatsapp";
}

export function etiquetaOrigenPedido(origen: OrigenPedido): string {
  return origen === "manual" ? "Manual" : "WhatsApp";
}
