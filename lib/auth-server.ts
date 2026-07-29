import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  verificarTokenSesion,
  type SesionUsuario,
} from "@/lib/auth";
import { rutaDashboardPorRol } from "@/lib/navegacion-dashboard";
import { puedeAccederModulo, type Modulo } from "@/lib/roles";

export async function obtenerSesion(): Promise<SesionUsuario | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return verificarTokenSesion(token);
}

export async function requerirSesion(): Promise<SesionUsuario> {
  const sesion = await obtenerSesion();

  if (!sesion) {
    redirect("/login");
  }

  return sesion;
}

export async function obtenerNombreSesion(): Promise<string | null> {
  const sesion = await obtenerSesion();
  return sesion?.nombre ?? sesion?.usuario ?? null;
}

export async function requerirModulo(modulo: Modulo): Promise<SesionUsuario> {
  const sesion = await requerirSesion();

  if (!puedeAccederModulo(sesion.rol, modulo)) {
    redirect(rutaDashboardPorRol(sesion.rol));
  }

  return sesion;
}
