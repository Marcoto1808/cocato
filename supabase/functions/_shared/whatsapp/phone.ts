export function normalizarTelefono(valor: string): string {
  let digits = valor.replace(/\D/g, "");

  if (digits.startsWith("521") && digits.length === 13) {
    digits = `52${digits.slice(3)}`;
  }

  if (digits.length === 10) {
    digits = `52${digits}`;
  }

  return digits;
}

export function telefonosCoinciden(a: string | null | undefined, b: string): boolean {
  const na = a ? normalizarTelefono(a) : "";
  const nb = normalizarTelefono(b);
  if (!na || !nb) return false;
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}
