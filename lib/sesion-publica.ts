import type { SesionUsuario } from "@/lib/auth";

export type UsuarioPublico = {
  id: string;
  nombre: string;
  usuario: string;
};

export function usuarioPublico(sesion: SesionUsuario): UsuarioPublico {
  return {
    id: sesion.id,
    nombre: sesion.nombre,
    usuario: sesion.usuario,
  };
}
