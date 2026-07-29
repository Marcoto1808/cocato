import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth-server";
import { rutaDashboardPorRol } from "@/lib/navegacion-dashboard";

export async function GET() {
  const sesion = await obtenerSesion();

  if (!sesion) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    usuario: sesion,
    dashboardPath: rutaDashboardPorRol(sesion.rol),
  });
}
