import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  crearTokenSesion,
  opcionesCookieSesion,
  SESSION_COOKIE,
} from "@/lib/auth";
import { normalizarRol } from "@/lib/roles";
import { rutaDashboardPorRol } from "@/lib/navegacion-dashboard";
import { usuarioPublico } from "@/lib/sesion-publica";

type UsuarioLogin = {
  id: string;
  nombre: string;
  usuario: string;
  correo: string | null;
  rol: string;
  activo: boolean;
};

function logLogin(mensaje: string, detalle?: unknown) {
  if (detalle !== undefined) {
    console.log(`[auth/login] ${mensaje}`, detalle);
    return;
  }

  console.log(`[auth/login] ${mensaje}`);
}

function formatearErrorSupabase(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}) {
  return {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
}

export async function POST(request: Request) {
  logLogin("POST /api/auth/login recibido");

  const body = (await request.json()) as {
    usuario?: string;
    password?: string;
  };

  const usuario = body.usuario?.trim();
  const password = body.password ?? "";

  logLogin("Usuario recibido", {
    usuario: usuario ?? null,
    passwordRecibida: Boolean(password),
    longitudPassword: password.length,
  });

  if (!usuario || !password) {
    logLogin("Respondiendo 401: credenciales incompletas", {
      motivo: !usuario
        ? "Falta usuario"
        : "Falta contraseña",
      usuarioPresente: Boolean(usuario),
      passwordPresente: Boolean(password),
    });

    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos." },
      { status: 401 }
    );
  }

  logLogin("Llamando a Supabase RPC verificar_login", {
    p_usuario: usuario,
  });

  const { data, error } = await supabase.rpc("verificar_login", {
    p_usuario: usuario,
    p_password: password,
  });

  logLogin("Resultado de verificar_login", {
    data,
    error: error ? formatearErrorSupabase(error) : null,
  });

  if (error) {
    logLogin("Respondiendo 500: error de Supabase en verificar_login", {
      motivo: "La RPC verificar_login falló",
      supabase: formatearErrorSupabase(error),
    });

    console.error("[auth/login] verificar_login:", error);
    return NextResponse.json(
      { error: "No se pudo iniciar sesión. Intenta de nuevo." },
      { status: 500 }
    );
  }

  const filas = (data ?? []) as UsuarioLogin[];
  const encontrado = filas[0];

  logLogin("Filas devueltas por verificar_login", {
    totalFilas: filas.length,
    devolvioFilas: filas.length > 0,
    primeraFila: encontrado
      ? {
          id: encontrado.id,
          usuario: encontrado.usuario,
          nombre: encontrado.nombre,
          rol: encontrado.rol,
          activo: encontrado.activo,
        }
      : null,
  });

  if (!encontrado) {
    logLogin("Respondiendo 401: credenciales incorrectas", {
      motivo:
        "verificar_login no devolvió filas (usuario inexistente o contraseña incorrecta)",
      totalFilas: filas.length,
    });

    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos." },
      { status: 401 }
    );
  }

  if (!encontrado.activo) {
    logLogin("Respondiendo 403: usuario inactivo", {
      motivo: "El usuario existe pero activo = false",
      id: encontrado.id,
      usuario: encontrado.usuario,
    });

    return NextResponse.json(
      { error: "Este usuario está deshabilitado." },
      { status: 403 }
    );
  }

  const rol = normalizarRol(encontrado.rol) ?? "colaborador";

  logLogin("Rol normalizado", {
    rolOriginal: encontrado.rol,
    rolNormalizado: rol,
  });

  const sesion = {
    id: encontrado.id,
    nombre: encontrado.nombre,
    usuario: encontrado.usuario,
    rol,
  };

  try {
    const token = await crearTokenSesion(sesion);

    logLogin("Sesión creada correctamente", {
      redirectTo: rutaDashboardPorRol(rol),
      usuario: usuarioPublico(sesion),
    });

    const respuesta = NextResponse.json({
      redirectTo: rutaDashboardPorRol(rol),
      usuario: usuarioPublico(sesion),
    });

    respuesta.cookies.set(SESSION_COOKIE, token, opcionesCookieSesion());
    return respuesta;
  } catch (tokenError) {
    logLogin("Respondiendo 500: error al crear token de sesión", {
      motivo: "crearTokenSesion lanzó una excepción",
      error:
        tokenError instanceof Error
          ? {
              name: tokenError.name,
              message: tokenError.message,
              stack: tokenError.stack,
            }
          : tokenError,
    });

    return NextResponse.json(
      { error: "No se pudo iniciar sesión. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
