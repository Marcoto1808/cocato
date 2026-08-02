import { NextResponse } from "next/server";
import {
  validarFirmaWebhook,
  verificarWebhookGet,
  type WhatsAppWebhookPayload,
} from "@/lib/whatsapp/webhook-validator";
import { obtenerWhatsAppService } from "@/lib/whatsapp/whatsapp-service";
import {
  esEventoYCloud,
  parseYCloudWebhook,
  validarFirmaYCloud,
  whatsappProvider,
} from "@/lib/whatsapp/ycloud-webhook";
import {
  handlerWebhookWhatsApp,
  urlWebhookWhatsAppSupabase,
} from "@/lib/whatsapp-webhook-url";
import { obtenerSupabaseAdmin } from "@/lib/supabase-admin";

async function actualizarEstadoMensajePorWamid(
  input: {
    waMessageId: string;
    status: string;
    errorMessage?: string | null;
    ycloudEventId?: string;
  }
) {
  const db = obtenerSupabaseAdmin();
  const { data, error } = await db
    .from("whatsapp_messages")
    .select("id, payload_raw")
    .eq("wa_message_id", input.waMessageId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { encontrado: false };

  const previo =
    data.payload_raw && typeof data.payload_raw === "object"
      ? (data.payload_raw as Record<string, unknown>)
      : {};

  const update: Record<string, unknown> = {
    payload_raw: {
      ...previo,
      ycloudStatus: input.status,
      ycloudStatusAt: new Date().toISOString(),
      ycloudEventId: input.ycloudEventId ?? previo.ycloudEventId,
    },
  };

  if (input.status === "failed" && input.errorMessage) {
    update.error_procesamiento = input.errorMessage;
  }

  await db.from("whatsapp_messages").update(update).eq("id", data.id);
  return { encontrado: true, status: input.status };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (handlerWebhookWhatsApp() === "supabase") {
    const destino = urlWebhookWhatsAppSupabase();
    if (mode === "subscribe") {
      return NextResponse.json(
        {
          error: "Webhook desactivado en Vercel.",
          handler: "supabase",
          configure_en: destino,
        },
        { status: 410 }
      );
    }

    if (whatsappProvider() === "ycloud") {
      return NextResponse.json({
        status: "ok",
        provider: "ycloud",
        message:
          "YCloud no usa verificación GET. Registra la URL de Supabase en la consola YCloud.",
        webhook_url: destino,
      });
    }
  }

  try {
    const respuesta = verificarWebhookGet(mode, token, challenge);

    if (!respuesta) {
      return NextResponse.json({ error: "Verificación fallida." }, { status: 403 });
    }

    return new NextResponse(respuesta, { status: 200 });
  } catch (error) {
    console.error("[whatsapp/webhook] GET error", error);
    return NextResponse.json(
      { error: "Configuración de webhook incompleta." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (handlerWebhookWhatsApp() === "supabase") {
    return NextResponse.json({
      status: "ignored",
      handler: "supabase",
      message:
        "Este endpoint no procesa mensajes. Configura YCloud con la Edge Function de Supabase.",
      webhook_url: urlWebhookWhatsAppSupabase(),
    });
  }

  const rawBody = await request.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (esEventoYCloud(payload)) {
    const signature = request.headers.get("YCloud-Signature");

    if (!validarFirmaYCloud(rawBody, signature)) {
      return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
    }

    const { inboundMessages, statusUpdates } = parseYCloudWebhook(payload);
    const actualizaciones = [];

    for (const update of statusUpdates) {
      actualizaciones.push(await actualizarEstadoMensajePorWamid(update));
    }

    if (inboundMessages.length === 0) {
      return NextResponse.json({
        status: "ok",
        provider: "ycloud",
        procesados: 0,
        actualizaciones,
      });
    }

    try {
      const servicio = obtenerWhatsAppService();
      let procesados = 0;

      for (const mensaje of inboundMessages) {
        await servicio.procesarMensajeEntrante({
          from: mensaje.from,
          waMessageId: mensaje.waMessageId,
          texto: mensaje.texto,
          phoneNumberId: mensaje.phoneNumberId ?? null,
        });
        procesados += 1;
      }

      return NextResponse.json({
        status: "ok",
        provider: "ycloud",
        procesados,
        actualizaciones,
      });
    } catch (error) {
      console.error("[whatsapp/webhook] POST ycloud error", error);
      return NextResponse.json({ error: "Error interno." }, { status: 500 });
    }
  }

  const signature = request.headers.get("x-hub-signature-256");

  if (!validarFirmaWebhook(rawBody, signature)) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  const metaPayload = payload as WhatsAppWebhookPayload;

  if (metaPayload.object !== "whatsapp_business_account") {
    return NextResponse.json({ status: "ignored" });
  }

  try {
    const resultado = await obtenerWhatsAppService().procesarWebhook(metaPayload);
    return NextResponse.json({ status: "ok", ...resultado });
  } catch (error) {
    console.error("[whatsapp/webhook] POST error", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
