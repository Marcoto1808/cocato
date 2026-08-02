import {
  whatsappAccessToken,
  whatsappApiVersion,
  whatsappPhoneNumberId,
  whatsappProvider,
  ycloudApiKey,
  ycloudWhatsAppFrom,
} from "../env.ts";
import { normalizarTelefono } from "./phone.ts";

export type EnviarMensajeResultado =
  | { ok: true; waMessageId?: string }
  | { ok: false; error: string };

function formatoE164(valor: string): string {
  const digits = valor.replace(/\D/g, "");
  return valor.startsWith("+") ? `+${digits}` : `+${digits}`;
}

async function enviarViaYCloud(input: {
  to: string;
  body: string;
  fromOverride?: string | null;
}): Promise<EnviarMensajeResultado> {
  try {
    const apiKey = ycloudApiKey();
    const from = ycloudWhatsAppFrom(input.fromOverride);
    const to = formatoE164(normalizarTelefono(input.to));

    const response = await fetch(
      "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly",
      {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to,
          type: "text",
          text: { body: input.body },
        }),
      }
    );

    const data = (await response.json()) as {
      id?: string;
      wamid?: string;
      error?: { message?: string };
      message?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        error: data.error?.message ?? data.message ?? `Error HTTP ${response.status}`,
      };
    }

    return { ok: true, waMessageId: data.wamid ?? data.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error al enviar mensaje.",
    };
  }
}

async function enviarViaMeta(input: {
  to: string;
  body: string;
  phoneNumberId?: string | null;
}): Promise<EnviarMensajeResultado> {
  try {
    const accessToken = whatsappAccessToken();
    const phoneNumberId = whatsappPhoneNumberId(input.phoneNumberId);
    const apiVersion = whatsappApiVersion();

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
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

    const data = (await response.json()) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      return {
        ok: false,
        error: data.error?.message ?? `Error HTTP ${response.status}`,
      };
    }

    return { ok: true, waMessageId: data.messages?.[0]?.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error al enviar mensaje.",
    };
  }
}

export async function enviarMensajeTexto(input: {
  to: string;
  body: string;
  phoneNumberId?: string | null;
}): Promise<EnviarMensajeResultado> {
  if (whatsappProvider() === "ycloud") {
    return enviarViaYCloud({
      to: input.to,
      body: input.body,
      fromOverride: input.phoneNumberId,
    });
  }

  return enviarViaMeta(input);
}

export async function verificarConexionWhatsApp(
  phoneNumberId?: string | null
): Promise<{ ok: boolean; detalle: string }> {
  if (whatsappProvider() === "ycloud") {
    try {
      const apiKey = ycloudApiKey();
      const from = ycloudWhatsAppFrom(phoneNumberId);

      const response = await fetch("https://api.ycloud.com/v2/balance", {
        headers: { "X-API-Key": apiKey },
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        return {
          ok: false,
          detalle: data.message ?? `Error HTTP ${response.status}`,
        };
      }

      return { ok: true, detalle: `YCloud conectado (${from})` };
    } catch (error) {
      return {
        ok: false,
        detalle:
          error instanceof Error ? error.message : "No se pudo verificar conexión.",
      };
    }
  }

  try {
    const accessToken = whatsappAccessToken();
    const id = whatsappPhoneNumberId(phoneNumberId);
    const apiVersion = whatsappApiVersion();

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const data = (await response.json()) as {
      id?: string;
      display_phone_number?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      return {
        ok: false,
        detalle: data.error?.message ?? `Error HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      detalle: data.display_phone_number
        ? `Conectado: ${data.display_phone_number}`
        : `Conectado (ID ${data.id ?? id})`,
    };
  } catch (error) {
    return {
      ok: false,
      detalle:
        error instanceof Error ? error.message : "No se pudo verificar conexión.",
    };
  }
}
