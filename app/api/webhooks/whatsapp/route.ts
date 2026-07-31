import { NextResponse } from "next/server";
import {
  validarFirmaWebhook,
  verificarWebhookGet,
  type WhatsAppWebhookPayload,
} from "@/lib/whatsapp/webhook-validator";
import { obtenerWhatsAppService } from "@/lib/whatsapp/whatsapp-service";
import {
  handlerWebhookWhatsApp,
  urlWebhookWhatsAppSupabase,
} from "@/lib/whatsapp-webhook-url";

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
          configure_en_meta: destino,
        },
        { status: 410 }
      );
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
        "Este endpoint no procesa mensajes. Configura Meta con la Edge Function de Supabase.",
      webhook_url: urlWebhookWhatsAppSupabase(),
    });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!validarFirmaWebhook(rawBody, signature)) {
    return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (payload.object !== "whatsapp_business_account") {
    return NextResponse.json({ status: "ignored" });
  }

  try {
    const resultado = await obtenerWhatsAppService().procesarWebhook(payload);
    return NextResponse.json({ status: "ok", ...resultado });
  } catch (error) {
    console.error("[whatsapp/webhook] POST error", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
