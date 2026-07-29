import { SignJWT, jwtVerify } from "jose";
import type { RolUsuario } from "@/lib/roles";

export const SESSION_COOKIE = "cocato_session";
export const SESSION_MAX_AGE_SEGUNDOS = 60 * 60 * 24 * 7;

export type SesionUsuario = {
  id: string;
  nombre: string;
  usuario: string;
  rol: RolUsuario;
};

export type PayloadSesion = SesionUsuario & {
  iat: number;
  exp: number;
};

function obtenerSecretoSesion() {
  const secreto = process.env.SESSION_SECRET?.trim();

  if (secreto) return secreto;

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET no está configurado.");
  }

  return "cocato-dev-session-secret";
}

function claveSesion() {
  return new TextEncoder().encode(obtenerSecretoSesion());
}

function logAuth(mensaje: string, detalle?: unknown) {
  if (detalle !== undefined) {
    console.log(`[auth] ${mensaje}`, detalle);
    return;
  }

  console.log(`[auth] ${mensaje}`);
}

export async function crearTokenSesion(usuario: SesionUsuario) {
  logAuth("crearTokenSesion: iniciando", {
    id: usuario.id,
    usuario: usuario.usuario,
    rol: usuario.rol,
    sessionSecretConfigurado: Boolean(process.env.SESSION_SECRET?.trim()),
    nodeEnv: process.env.NODE_ENV ?? "undefined",
  });

  try {
    const token = await new SignJWT({
      id: usuario.id,
      nombre: usuario.nombre,
      usuario: usuario.usuario,
      rol: usuario.rol,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_MAX_AGE_SEGUNDOS}s`)
      .sign(claveSesion());

    logAuth("crearTokenSesion: token generado correctamente", {
      longitudToken: token.length,
    });

    return token;
  } catch (error) {
    logAuth("crearTokenSesion: error al generar token", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });
    throw error;
  }
}

export async function verificarTokenSesion(
  token: string | undefined | null
): Promise<SesionUsuario | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, claveSesion());
    const id = typeof payload.id === "string" ? payload.id : null;
    const nombre = typeof payload.nombre === "string" ? payload.nombre : null;
    const usuario =
      typeof payload.usuario === "string" ? payload.usuario : null;
    const rol =
      payload.rol === "administrador" || payload.rol === "colaborador"
        ? payload.rol
        : null;

    if (!id || !nombre || !usuario || !rol) return null;

    return { id, nombre, usuario, rol };
  } catch {
    return null;
  }
}

export function opcionesCookieSesion() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEGUNDOS,
  };
}
