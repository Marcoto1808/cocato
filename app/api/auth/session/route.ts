import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth-server";
import { rutaDashboardPorRol } from "@/lib/navegacion-dashboard";
import { usuarioPublico } from "@/lib/sesion-publica";

export async function GET() {
  const sesion = await obtenerSesion();

  if (!sesion) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    usuario: usuarioPublico(sesion),
    dashboardPath: rutaDashboardPorRol(sesion.rol),
  });
}
