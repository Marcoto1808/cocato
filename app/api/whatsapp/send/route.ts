import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth-server";
import { obtenerWhatsAppService } from "@/lib/whatsapp/whatsapp-service";

export async function POST(request: Request) {
  const sesion = await obtenerSesion();

  if (!sesion || sesion.rol !== "administrador") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = (await request.json()) as {
    to?: string;
    body?: string;
  };

  const to = body.to?.trim();
  const mensaje = body.body?.trim();

  if (!to || !mensaje) {
    return NextResponse.json(
      { error: "Campos 'to' y 'body' son requeridos." },
      { status: 400 }
    );
  }

  try {
    const resultado = await obtenerWhatsAppService().enviarMensaje({ to, body: mensaje });

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.error }, { status: 502 });
    }

    return NextResponse.json({ ok: true, waMessageId: resultado.waMessageId });
  } catch (error) {
    console.error("[whatsapp/send] error", error);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
