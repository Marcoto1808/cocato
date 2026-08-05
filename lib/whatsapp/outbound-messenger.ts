import {
  enviarMensajeTextoYCloud,
  verificarConexionYCloud,
  whatsappProvider,
} from "@/lib/whatsapp/ycloud-webhook";
import { resolveMessagingChannel } from "@/lib/messaging/resolve-messaging-channel";
import { obtenerMessagingProviderRegistrado } from "@/lib/messaging/registry";

const API_VERSION = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";

export type EnviarMensajeResultado =
  | { ok: true; waMessageId?: string }
  | { ok: false; error: string };

function obtenerAccessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("WHATSAPP_ACCESS_TOKEN no está configurado.");
  }
  return token;
}

function resolverPhoneNumberId(override?: string | null): string {
  const fromConfig = override?.trim();
  const fromEnv =
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ||
    process.env.WHATSAPP_PHONE_NUMBER_ID;

  const phoneNumberId = fromConfig || fromEnv?.trim();
  if (!phoneNumberId) {
    throw new Error("Phone Number ID no configurado.");
  }

  return phoneNumberId;
}

async function enviarViaMeta(input: {
  to: string;
  body: string;
  phoneNumberId?: string | null;
}): Promise<EnviarMensajeResultado> {
  try {
    const accessToken = obtenerAccessToken();
    const phoneNumberId = resolverPhoneNumberId(input.phoneNumberId);

    const response = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
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

    return {
      ok: true,
      waMessageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error al enviar mensaje.",
    };
  }
}

export async function enviarMensajeTextoWhatsApp(input: {
  to: string;
  body: string;
  phoneNumberId?: string | null;
}): Promise<EnviarMensajeResultado> {
  if (resolveMessagingChannel() === "whatsapp-web") {
    const proveedor = obtenerMessagingProviderRegistrado();
    if (!proveedor) {
      return {
        ok: false,
        error:
          "WhatsApp Web no está activo. Ejecuta npm run whatsapp-web en otra terminal.",
      };
    }
    return proveedor.sendTextMessage(input);
  }

  if (whatsappProvider() === "ycloud") {
    return enviarMensajeTextoYCloud({
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
  if (resolveMessagingChannel() === "whatsapp-web") {
    const proveedor = obtenerMessagingProviderRegistrado();
    if (!proveedor?.verifyConnection) {
      return {
        ok: false,
        detalle: "Ejecuta npm run whatsapp-web para conectar WhatsApp Web.",
      };
    }
    return proveedor.verifyConnection(phoneNumberId);
  }

  if (whatsappProvider() === "ycloud") {
    return verificarConexionYCloud(phoneNumberId);
  }

  try {
    const accessToken = obtenerAccessToken();
    const id = resolverPhoneNumberId(phoneNumberId);

    const response = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
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
