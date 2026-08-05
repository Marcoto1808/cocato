import { normalizarTelefonoWa } from "@/lib/whatsapp/phone-utils";

/** Dígitos E.164 sin '+' (ej. 525551234567). */
export function normalizarTelefonoMensajeria(
  valor: string | null | undefined
): string {
  return normalizarTelefonoWa(valor);
}

/** Convierte teléfono normalizado a JID de WhatsApp Web (ej. 525551234567@c.us). */
export function telefonoAJid(valor: string): string {
  const digits = normalizarTelefonoMensajeria(valor);
  if (!digits) {
    throw new Error(`Teléfono inválido para JID: ${valor}`);
  }
  return `${digits}@c.us`;
}

/** Extrae dígitos desde un JID o número crudo. */
export function jidATelefono(jid: string): string {
  const base = jid.split("@")[0] ?? jid;
  return normalizarTelefonoMensajeria(base);
}
