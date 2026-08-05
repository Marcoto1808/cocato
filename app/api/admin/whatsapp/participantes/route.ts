import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth-server";
import { supabase } from "@/lib/supabase";
import {
  supabaseAdminDisponible,
  obtenerSupabaseAdmin,
} from "@/lib/supabase-admin";
import {
  eliminarParticipanteWhatsApp,
  guardarParticipantesWhatsApp,
  listarParticipantesWhatsApp,
} from "@/lib/whatsapp/config-repository";

async function requerirAdmin() {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.rol !== "administrador") {
    return null;
  }
  return sesion;
}

export async function GET() {
  const sesion = await requerirAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  try {
    const { data: clientes, error } = await supabase
      .from("clientes")
      .select("id, nombre_negocio, whatsapp, telefono, activo")
      .eq("activo", true)
      .order("nombre_negocio");

    if (error) {
      throw new Error(error.message);
    }

    if (!supabaseAdminDisponible()) {
      return NextResponse.json({
        participantes: [],
        clientes: clientes ?? [],
        aviso:
          "Clave de servidor Supabase no configurada: no se pueden listar participantes (SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY).",
      });
    }

    const db = obtenerSupabaseAdmin();
    const participantes = await listarParticipantesWhatsApp(db);

    return NextResponse.json({ participantes, clientes: clientes ?? [] });
  } catch (error) {
    console.error("[admin/whatsapp/participantes] GET", error);
    return NextResponse.json({ error: "Error al cargar participantes." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const sesion = await requerirAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  if (!supabaseAdminDisponible()) {
    return NextResponse.json(
      {
        error:
          "Clave de servidor Supabase no configurada (SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY). Agrégala en Vercel para gestionar participantes.",
      },
      { status: 503 }
    );
  }

  const body = (await request.json()) as {
    participantes?: Array<{
      cliente_id: string;
      activo: boolean;
      recibe_mensaje_automatico: boolean;
    }>;
  };

  try {
    const db = obtenerSupabaseAdmin();
    await guardarParticipantesWhatsApp(db, body.participantes ?? []);
    const participantes = await listarParticipantesWhatsApp(db);
    return NextResponse.json({ participantes });
  } catch (error) {
    console.error("[admin/whatsapp/participantes] PUT", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al guardar." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const sesion = await requerirAdmin();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  if (!supabaseAdminDisponible()) {
    return NextResponse.json(
      { error: "Clave de servidor Supabase no configurada (SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY)." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const clienteId = url.searchParams.get("cliente_id");

  if (!clienteId) {
    return NextResponse.json({ error: "cliente_id requerido." }, { status: 400 });
  }

  try {
    const db = obtenerSupabaseAdmin();
    await eliminarParticipanteWhatsApp(db, clienteId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/whatsapp/participantes] DELETE", error);
    return NextResponse.json({ error: "Error al eliminar participante." }, { status: 500 });
  }
}
