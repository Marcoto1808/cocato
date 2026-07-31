import {
  whatsappAccessToken,
  whatsappApiVersion,
  whatsappPhoneNumberId,
} from "../env.ts";

export type EnviarMensajeResultado =
  | { ok: true; waMessageId?: string }
  | { ok: false; error: string };

export async function enviarMensajeTexto(input: {
  to: string;
  body: string;
  phoneNumberId?: string | null;
}): Promise<EnviarMensajeResultado> {
  const token = whatsappAccessToken();
  const phoneNumberId = whatsappPhoneNumberId(input.phoneNumberId ?? undefined);
  const apiVersion = whatsappApiVersion();

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to.replace(/\D/g, ""),
        type: "text",
        text: { body: input.body },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      error: data?.error?.message ?? `HTTP ${response.status}`,
    };
  }

  return { ok: true, waMessageId: data?.messages?.[0]?.id };
}
