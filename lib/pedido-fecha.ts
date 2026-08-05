const ZONA_HORARIA_MX = "America/Mexico_City";

/** Parsea fecha de pedido (date-only o ISO completo). */
export function parseFechaPedido(fecha: string): Date | null {
  if (!fecha?.trim()) return null;

  const parsed = fecha.includes("T")
    ? new Date(fecha)
    : new Date(`${fecha}T12:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Formato corto estable para SSR y cliente (evita hydration mismatch). */
export function formatFechaCortaMx(fecha: string): string {
  const parsed = parseFechaPedido(fecha);
  if (!parsed) return fecha;

  return parsed.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: ZONA_HORARIA_MX,
  });
}

/** Formato largo para detalle de pedido. */
export function formatFechaPedidoDetalle(fecha: string): string {
  const parsed = parseFechaPedido(fecha);
  if (!parsed) return fecha;

  return parsed.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: ZONA_HORARIA_MX,
  });
}

/** Partes de calendario en zona MX (estable en servidor y cliente). */
function partesCalendarioMx(fecha: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA_MX,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);

  return {
    year: partes.find((p) => p.type === "year")?.value ?? "",
    month: partes.find((p) => p.type === "month")?.value ?? "",
    day: partes.find((p) => p.type === "day")?.value ?? "",
  };
}

/** Compara si una fecha ISO corresponde al mismo día calendario MX que la referencia. */
export function esMismoDiaCalendario(
  fechaIso: string,
  referencia: Date = new Date()
): boolean {
  const fecha = parseFechaPedido(fechaIso);
  if (!fecha) return false;

  const diaPedido = partesCalendarioMx(fecha);
  const diaReferencia = partesCalendarioMx(referencia);

  return (
    diaPedido.year === diaReferencia.year &&
    diaPedido.month === diaReferencia.month &&
    diaPedido.day === diaReferencia.day
  );
}
