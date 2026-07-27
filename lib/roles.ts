export type RolUsuario = "administrador" | "colaborador";

export type Modulo =
  | "dashboard"
  | "clientes"
  | "productos"
  | "pedidos"
  | "usuarios";

export type PermisoPedido =
  | "ver_lista"
  | "ver_detalle"
  | "consultar_cliente"
  | "abrir_maps"
  | "imprimir_nota"
  | "cambiar_estado";

export type Usuario = {
  id: string;
  usuario: string;
  password?: string;
  rol: RolUsuario;
};

export const ROLES: RolUsuario[] = ["administrador", "colaborador"];

export const MODULOS_POR_ROL: Record<RolUsuario, Modulo[]> = {
  administrador: [
    "dashboard",
    "clientes",
    "productos",
    "pedidos",
    "usuarios",
  ],
  colaborador: ["pedidos"],
};

export const PERMISOS_PEDIDOS_POR_ROL: Record<RolUsuario, PermisoPedido[]> = {
  administrador: [
    "ver_lista",
    "ver_detalle",
    "consultar_cliente",
    "abrir_maps",
    "imprimir_nota",
    "cambiar_estado",
  ],
  colaborador: [
    "ver_lista",
    "ver_detalle",
    "consultar_cliente",
    "abrir_maps",
    "imprimir_nota",
    "cambiar_estado",
  ],
};

export const ETIQUETAS_MODULO: Record<Modulo, string> = {
  dashboard: "Dashboard",
  clientes: "Clientes",
  productos: "Productos",
  pedidos: "Pedidos",
  usuarios: "Usuarios",
};

export const ETIQUETAS_ROL: Record<RolUsuario, string> = {
  administrador: "Administrador",
  colaborador: "Colaborador",
};

export function normalizarRol(valor: string | null | undefined): RolUsuario | null {
  if (!valor) return null;

  const rol = valor.toLowerCase().trim();

  if (rol === "administrador" || rol === "admin") return "administrador";
  if (rol === "colaborador") return "colaborador";

  return null;
}

export function esRolUsuario(valor: string | null | undefined): valor is RolUsuario {
  return normalizarRol(valor) !== null;
}

export function puedeAccederModulo(rol: RolUsuario, modulo: Modulo): boolean {
  return MODULOS_POR_ROL[rol].includes(modulo);
}

export function puedeUsarPermisoPedido(
  rol: RolUsuario,
  permiso: PermisoPedido
): boolean {
  return PERMISOS_PEDIDOS_POR_ROL[rol].includes(permiso);
}

export function esAdministrador(rol: RolUsuario): boolean {
  return rol === "administrador";
}

export function esColaborador(rol: RolUsuario): boolean {
  return rol === "colaborador";
}

export function modulosDisponibles(rol: RolUsuario): Modulo[] {
  return MODULOS_POR_ROL[rol];
}

export function usuarioDesdeSupabase(data: Record<string, unknown>): Usuario | null {
  const rol = normalizarRol(String(data.rol ?? ""));

  if (!rol || typeof data.id !== "string" || typeof data.usuario !== "string") {
    return null;
  }

  return {
    id: data.id,
    usuario: data.usuario,
    rol,
    ...(typeof data.password === "string" ? { password: data.password } : {}),
  };
}
