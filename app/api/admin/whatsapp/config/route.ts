import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth-server";
import {
  supabaseAdminDisponible,
  obtenerSupabaseAdmin,
} from "@/lib/supabase-admin";
import {
  actualizarWhatsAppConfig,
  listarPlantillasWhatsApp,
  obtenerWhatsAppConfig,
} from "@/lib/whatsapp/config-repository";
import { verificarConexionWhatsApp } from "@/lib/whatsapp/outbound-messenger";
import {
  handlerWebhookWhatsApp,
  urlWebhookWhatsAppSupabase,
} from "@/lib/whatsapp-webhook-url";

async function requerirAdmin() {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "administrador") {
    return null;
  }
  return sesion;
}

async function verificarConexionSegura(phoneNumberId?: string | null) {
  try {
    return await verificarConexionWhatsApp(phoneNumberId);
  } catch (error) {
    return {
      ok: false,
      detalle:
        error instanceof Error
          ? error.message
          : "No se pudo verificar la conexión.",
    };
  }
}

export async function GET() {
  const sesion = await requerirAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const webhookSupabase = urlWebhookWhatsAppSupabase();
  const credenciales = {
    accessToken: Boolean(process.env.WHATSAPP_ACCESS_TOKEN?.trim()),
    verifyToken: Boolean(process.env.WHATSAPP_VERIFY_TOKEN?.trim()),
    appSecret: Boolean(process.env.WHATSAPP_APP_SECRET?.trim()),
    phoneNumberIdEnv: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()),
    serviceRole: supabaseAdminDisponible(),
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
  };

  if (!supabaseAdminDisponible()) {
    return NextResponse.json({
      config: null,
      plantillas: [],
      credenciales,
      conexion: {
        ok: false,
        detalle:
          "SUPABASE_SERVICE_ROLE_KEY no configurada en Vercel (solo afecta este panel; el webhook corre en Supabase).",
      },
      webhookUrl: webhookSupabase,
      webhookHandler: handlerWebhookWhatsApp(),
      aviso:
        "El procesamiento de WhatsApp ocurre en Supabase Edge Functions. Este panel es solo configuración.",
    });
  }

  try {
    const db = obtenerSupabaseAdmin();
    const config = await obtenerWhatsAppConfig(db);
    const plantillas = await listarPlantillasWhatsApp(db);

    const conexion = config?.phone_number_id
      ? await verificarConexionSegura(config.phone_number_id)
      : credenciales.phoneNumberIdEnv
        ? await verificarConexionSegura(process.env.WHATSAPP_PHONE_NUMBER_ID)
        : { ok: false, detalle: "Phone Number ID no configurado." };

    return NextResponse.json({
      config,
      plantillas,
      credenciales,
      conexion,
      webhookUrl: webhookSupabase,
      webhookHandler: handlerWebhookWhatsApp(),
    });
  } catch (error) {
    console.error("[admin/whatsapp/config] GET", error);
    return NextResponse.json({
      config: null,
      plantillas: [],
      credenciales,
      conexion: {
        ok: false,
        detalle: "Error al cargar configuración.",
      },
      webhookUrl: webhookSupabase,
      webhookHandler: handlerWebhookWhatsApp(),
      error: "Error al cargar configuración.",
    });
  }
}

export async function PATCH(request: Request) {
  const sesion = await requerirAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  if (!supabaseAdminDisponible()) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY no configurada. Agrégala en Vercel para guardar desde este panel.",
      },
      { status: 503 }
    );
  }

  const body = (await request.json()) as {
    activo?: boolean;
    hora_mensaje_automatico?: string | null;
    plantilla_mensaje_id?: string | null;
    phone_number_id?: string | null;
  };

  try {
    const db = obtenerSupabaseAdmin();
    const config = await actualizarWhatsAppConfig(db, {
      activo: body.activo,
      hora_mensaje_automatico: body.hora_mensaje_automatico,
      plantilla_mensaje_id: body.plantilla_mensaje_id,
      phone_number_id: body.phone_number_id,
    });

    return NextResponse.json({ config });
  } catch (error) {
    console.error("[admin/whatsapp/config] PATCH", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al guardar." },
      { status: 500 }
    );
  }
}
