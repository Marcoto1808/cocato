export type EstadoCategoria = "pendiente" | "listo" | "entregado";

export const ESTADOS_ACTIVOS: EstadoCategoria[] = ["pendiente", "listo"];

export function normalizarEstado(estado: string): EstadoCategoria | null {
  const valor = estado.toLowerCase().trim();

  if (valor.includes("entregado")) return "entregado";
  if (valor.includes("listo") || valor.includes("reparto")) return "listo";
  if (valor.includes("pendiente") || valor.includes("preparando")) {
    return "pendiente";
  }

  return null;
}

export function esPedidoActivo(estado: string) {
  const categoria = normalizarEstado(estado);
  return categoria === "pendiente" || categoria === "listo";
}

export function esPedidoEntregado(estado: string) {
  return normalizarEstado(estado) === "entregado";
}

export function esPedidoOperativo(estado: string) {
  return esPedidoActivo(estado);
}

/** Compatibilidad: reparto ahora cuenta como listo. */
export function esPedidoEnReparto(estado: string) {
  return estado.toLowerCase().includes("reparto");
}

export function etiquetaEstado(estado: string | null) {
  if (!estado) return "Sin estado";

  const categoria = normalizarEstado(estado);

  switch (categoria) {
    case "pendiente":
      return "🟡 Pendiente";
    case "listo":
      return "🟢 Listo";
    case "entregado":
      return "✅ Entregado";
    default:
      return estado;
  }
}
