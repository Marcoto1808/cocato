export function normalizarTelefonoWa(valor: string | null | undefined): string {
  if (!valor?.trim()) return "";

  let digits = valor.replace(/\D/g, "");

  if (digits.startsWith("521") && digits.length === 13) {
    digits = `52${digits.slice(3)}`;
  }

  if (digits.length === 10) {
    digits = `52${digits}`;
  }

  return digits;
}

export function telefonosCoinciden(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const na = normalizarTelefonoWa(a);
  const nb = normalizarTelefonoWa(b);
  if (!na || !nb) return false;
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}
