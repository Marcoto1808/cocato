/** Producción YCloud. El 5009 ya no está registrado en YCloud. */
const WHATSAPP_NEGOCIO_PRODUCCION = "525635594183";
const WHATSAPP_NEGOCIO_LEGACY = new Set(["525657195009", "5657195009"]);

/** Resuelve el número del negocio en E.164 para envío YCloud. */
export function canonicalizarWhatsAppFromNegocio(valor: string): string {
  let digits = valor.replace(/\D/g, "");
  if (WHATSAPP_NEGOCIO_LEGACY.has(digits)) {
    digits = WHATSAPP_NEGOCIO_PRODUCCION;
  }
  return `+${digits}`;
}

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
