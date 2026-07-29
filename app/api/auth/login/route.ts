import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  crearTokenSesion,
  opcionesCookieSesion,
  SESSION_COOKIE,
} from "@/lib/auth";
import { normalizarRol } from "@/lib/roles";
import { rutaDashboardPorRol } from "@/lib/navegacion-dashboard";

type UsuarioLogin = {
  id: string;
  nombre: string;
  usuario: string;
  correo: string | null;
  rol: string;
  activo: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json()) as {
    usuario?: string;
    password?: string;
  };

  const usuario = body.usuario?.trim();
  const password = body.password ?? "";

  if (!usuario || !password) {
    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos." },
      { status: 401 }
    );
  }

  const { data, error } = await supabase.rpc("verificar_login", {
    p_usuario: usuario,
    p_password: password,
  });

  if (error) {
    console.error("[auth/login] verificar_login:", error);
    return NextResponse.json(
      { error: "No se pudo iniciar sesión. Intenta de nuevo." },
      { status: 500 }
    );
  }

  const filas = (data ?? []) as UsuarioLogin[];
  const encontrado = filas[0];

  if (!encontrado) {
    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos." },
      { status: 401 }
    );
  }

  if (!encontrado.activo) {
    return NextResponse.json(
      { error: "Este usuario está deshabilitado." },
      { status: 403 }
    );
  }

  const rol = normalizarRol(encontrado.rol) ?? "colaborador";
  const sesion = {
    id: encontrado.id,
    nombre: encontrado.nombre,
    usuario: encontrado.usuario,
    rol,
  };

  const token = await crearTokenSesion(sesion);
  const respuesta = NextResponse.json({
    redirectTo: rutaDashboardPorRol(rol),
    usuario: sesion,
  });

  respuesta.cookies.set(SESSION_COOKIE, token, opcionesCookieSesion());
  return respuesta;
}
