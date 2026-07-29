/** Compara si una fecha ISO corresponde al mismo día calendario que la referencia. */
export function esMismoDiaCalendario(
  fechaIso: string,
  referencia: Date = new Date()
): boolean {
  const fecha = new Date(fechaIso);

  return (
    fecha.getFullYear() === referencia.getFullYear() &&
    fecha.getMonth() === referencia.getMonth() &&
    fecha.getDate() === referencia.getDate()
  );
}
