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

const YCLOUD_SEND_ENDPOINT =
  "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly";

function enmascararApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return "***";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)} (len=${apiKey.length})`;
}

function resumenCuerpo(body: string, max = 120): string {
  const compacto = body.replace(/\s+/g, " ").trim();
  if (compacto.length <= max) return compacto;
  return `${compacto.slice(0, max)}…`;
}

function formatoE164(valor: string): string {
  const digits = valor.replace(/\D/g, "");
  return valor.startsWith("+") ? `+${digits}` : `+${digits}`;
}

async function enviarViaYCloud(input: {
  to: string;
  body: string;
  fromOverride?: string | null;
}): Promise<EnviarMensajeResultado> {
  const traceId = crypto.randomUUID();

  try {
    const apiKey = ycloudApiKey();
    const from = ycloudWhatsAppFrom(input.fromOverride);
    const to = formatoE164(normalizarTelefono(input.to));
    const payload = {
      from,
      to,
      type: "text" as const,
      text: { body: input.body },
    };

    console.log(
      JSON.stringify({
        event: "whatsapp_outbound_inicio",
        trace_id: traceId,
        provider: "ycloud",
        endpoint: YCLOUD_SEND_ENDPOINT,
        auth_header: "X-API-Key",
        api_key: enmascararApiKey(apiKey),
        from,
        to,
        body_preview: resumenCuerpo(input.body),
        from_override: input.fromOverride ?? null,
      })
    );

    const response = await fetch(YCLOUD_SEND_ENDPOINT, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawResponse = await response.text();
    let data: Record<string, unknown> = {};

    try {
      data = rawResponse ? (JSON.parse(rawResponse) as Record<string, unknown>) : {};
    } catch {
      data = { raw: rawResponse };
    }

    if (!response.ok) {
      console.error(
        JSON.stringify({
          event: "whatsapp_outbound_error",
          trace_id: traceId,
          provider: "ycloud",
          endpoint: YCLOUD_SEND_ENDPOINT,
          http_status: response.status,
          http_status_text: response.statusText,
          ycloud_response: data,
          from,
          to,
        })
      );

      const errorObj = data.error as { message?: string } | undefined;
      const message =
        typeof data.message === "string" ? data.message : undefined;

      return {
        ok: false,
        error:
          errorObj?.message ??
          message ??
          `Error HTTP ${response.status}: ${rawResponse || response.statusText}`,
      };
    }

    console.log(
      JSON.stringify({
        event: "whatsapp_outbound_ok",
        trace_id: traceId,
        provider: "ycloud",
        endpoint: YCLOUD_SEND_ENDPOINT,
        http_status: response.status,
        ycloud_response: data,
        wamid:
          (typeof data.wamid === "string" ? data.wamid : undefined) ??
          (typeof data.id === "string" ? data.id : undefined) ??
          null,
        from,
        to,
      })
    );

    const wamid =
      typeof data.wamid === "string"
        ? data.wamid
        : typeof data.id === "string"
          ? data.id
          : undefined;

    return { ok: true, waMessageId: wamid };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "whatsapp_outbound_excepcion",
        trace_id: traceId,
        provider: "ycloud",
        endpoint: YCLOUD_SEND_ENDPOINT,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    );

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
  const provider = whatsappProvider();

  console.log(
    JSON.stringify({
      event: "whatsapp_outbound_dispatch",
      provider,
      to: input.to,
      phone_number_id: input.phoneNumberId ?? null,
      body_length: input.body.length,
    })
  );

  if (provider === "ycloud") {
    return await enviarViaYCloud({
      to: input.to,
      body: input.body,
      fromOverride: input.phoneNumberId,
    });
  }

  return await enviarViaMeta(input);
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
