export type EstadoCategoria =
  | "pendiente"
  | "preparando"
  | "listo"
  | "reparto"
  | "entregado";

export const ESTADOS_ACTIVOS: EstadoCategoria[] = [
  "pendiente",
  "preparando",
  "listo",
  "reparto",
];

export function normalizarEstado(estado: string): EstadoCategoria | null {
  const valor = estado.toLowerCase().trim();

  if (valor.includes("pendiente")) return "pendiente";
  if (valor.includes("listo")) return "listo";
  if (valor.includes("preparando")) return "preparando";
  if (valor.includes("reparto")) return "reparto";
  if (valor.includes("entregado")) return "entregado";

  return null;
}

export function esPedidoActivo(estado: string) {
  const categoria = normalizarEstado(estado);
  return categoria !== null && categoria !== "entregado";
}

export function esPedidoEntregado(estado: string) {
  return normalizarEstado(estado) === "entregado";
}

export function etiquetaEstado(estado: string | null) {
  if (!estado) return "Sin estado";

  const categoria = normalizarEstado(estado);

  switch (categoria) {
    case "pendiente":
      return "🟡 Pendiente";
    case "preparando":
      return "🟡 Preparando";
    case "listo":
      return "🟢 Listo";
    case "reparto":
      return "🚚 En reparto";
    case "entregado":
      return "✅ Entregado";
    default:
      return estado;
  }
}
