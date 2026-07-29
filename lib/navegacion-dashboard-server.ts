import { obtenerSesion } from "@/lib/auth-server";
import { rutaDashboardPorRol } from "@/lib/navegacion-dashboard";

export async function obtenerRutaDashboardServidor() {
  const sesion = await obtenerSesion();
  return rutaDashboardPorRol(sesion?.rol);
}
