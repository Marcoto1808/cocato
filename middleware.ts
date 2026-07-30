import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verificarTokenSesion, SESSION_COOKIE } from "@/lib/auth";
import {
  puedeAccederModulo,
  type Modulo,
  type RolUsuario,
} from "@/lib/roles";
import { rutaDashboardPorRol } from "@/lib/navegacion-dashboard";

const RUTAS_PUBLICAS = ["/login", "/api/auth/login", "/api/auth/logout"];

function esRutaPublica(pathname: string) {
  return RUTAS_PUBLICAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
  );
}

function moduloDesdeRuta(pathname: string): Modulo | null {
  if (pathname.startsWith("/dashboard/admin")) return "dashboard";
  if (pathname.startsWith("/clientes")) return "clientes";
  if (pathname.startsWith("/cobranza")) return "cobranza";
  if (pathname.startsWith("/productos")) return "productos";
  if (pathname.startsWith("/usuarios")) return "usuarios";
  if (pathname.startsWith("/balance")) return "balance";
  if (pathname.startsWith("/dashboard/reportes")) return "reportes";
  if (pathname.startsWith("/dashboard/pedidos") || pathname === "/dashboard") {
    return "pedidos";
  }
  return null;
}

function puedeAccederRuta(rol: RolUsuario, pathname: string) {
  if (pathname.startsWith("/dashboard/admin")) {
    return rol === "administrador";
  }

  const modulo = moduloDesdeRuta(pathname);
  if (!modulo) return true;

  return puedeAccederModulo(rol, modulo);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const sesion = await verificarTokenSesion(token);

  if (esRutaPublica(pathname)) {
    if (sesion && pathname === "/login") {
      return NextResponse.redirect(
        new URL(rutaDashboardPorRol(sesion.rol), request.url)
      );
    }

    return NextResponse.next();
  }

  if (pathname === "/") {
    if (sesion) {
      return NextResponse.redirect(
        new URL(rutaDashboardPorRol(sesion.rol), request.url)
      );
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!sesion) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!puedeAccederRuta(sesion.rol, pathname)) {
    return NextResponse.redirect(
      new URL(rutaDashboardPorRol(sesion.rol), request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
