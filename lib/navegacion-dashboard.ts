import type { RolUsuario } from "@/lib/roles";

export const RUTA_DASHBOARD_COLABORADOR = "/dashboard";
export const RUTA_DASHBOARD_ADMINISTRADOR = "/dashboard/admin";

export function rutaDashboardPorRol(
  rol: RolUsuario | null | undefined
): string {
  return rol === "administrador"
    ? RUTA_DASHBOARD_ADMINISTRADOR
    : RUTA_DASHBOARD_COLABORADOR;
}

export function rutaDashboardDesdeSesion(
  rol: RolUsuario | null | undefined
): string {
  return rutaDashboardPorRol(rol);
}
