import { normalizarRol, type RolUsuario } from "@/lib/roles";

export const COOKIE_USUARIO = "cocato_usuario";
export const COOKIE_ROL = "cocato_rol";

export const RUTA_DASHBOARD_COLABORADOR = "/dashboard";
export const RUTA_DASHBOARD_ADMINISTRADOR = "/dashboard/admin";

export function rutaDashboardPorRol(
  rol: RolUsuario | null | undefined
): string {
  return rol === "administrador"
    ? RUTA_DASHBOARD_ADMINISTRADOR
    : RUTA_DASHBOARD_COLABORADOR;
}

export function rutaDashboardDesdeCookie(
  valorCookie: string | null | undefined
): string {
  return rutaDashboardPorRol(normalizarRol(valorCookie) ?? "colaborador");
}

export function guardarSesionEnCookies(usuario: string, rol: RolUsuario) {
  if (typeof document === "undefined") return;

  document.cookie = `${COOKIE_USUARIO}=${encodeURIComponent(usuario)}; path=/; SameSite=Lax`;
  document.cookie = `${COOKIE_ROL}=${encodeURIComponent(rol)}; path=/; SameSite=Lax`;
}

export function leerRolDesdeDocumento(): string | null {
  if (typeof document === "undefined") return null;

  const coincidencia = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_ROL}=([^;]*)`)
  );

  return coincidencia ? decodeURIComponent(coincidencia[1]) : null;
}

export function leerRutaDashboardDesdeDocumento(): string {
  return rutaDashboardDesdeCookie(leerRolDesdeDocumento());
}
