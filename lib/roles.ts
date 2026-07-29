export type RolUsuario = "administrador" | "colaborador";

export type Modulo =
  | "dashboard"
  | "clientes"
  | "productos"
  | "pedidos"
  | "usuarios"
  | "balance";

export type PermisoPedido =
  | "ver_lista"
  | "ver_detalle"
  | "crear"
  | "agregar_productos"
  | "consultar_cliente"
  | "abrir_maps"
  | "imprimir_nota"
  | "cambiar_estado";

export type PermisoOperacion =
  | "crear_pedidos"
  | "agregar_productos_pedido"
  | "preparar_pedidos"
  | "buscar_clientes"
  | "crear_clientes"
  | "editar_clientes"
  | "crear_productos"
  | "editar_productos"
  | "activar_productos"
  | "modificar_listas_precio";

export type Usuario = {
  id: string;
  nombre: string;
  usuario: string;
  correo?: string | null;
  rol: RolUsuario;
  activo?: boolean;
};

export const ROLES: RolUsuario[] = ["administrador", "colaborador"];

export const MODULOS_POR_ROL: Record<RolUsuario, Modulo[]> = {
  administrador: [
    "dashboard",
    "clientes",
    "productos",
    "pedidos",
    "usuarios",
    "balance",
  ],
  colaborador: ["clientes", "productos", "pedidos"],
};

export const PERMISOS_PEDIDOS_POR_ROL: Record<RolUsuario, PermisoPedido[]> = {
  administrador: [
    "ver_lista",
    "ver_detalle",
    "crear",
    "agregar_productos",
    "consultar_cliente",
    "abrir_maps",
    "imprimir_nota",
    "cambiar_estado",
  ],
  colaborador: [
    "ver_lista",
    "ver_detalle",
    "crear",
    "agregar_productos",
    "consultar_cliente",
    "abrir_maps",
    "imprimir_nota",
    "cambiar_estado",
  ],
};

export const PERMISOS_OPERACION_POR_ROL: Record<
  RolUsuario,
  PermisoOperacion[]
> = {
  administrador: [
    "crear_pedidos",
    "agregar_productos_pedido",
    "preparar_pedidos",
    "buscar_clientes",
    "crear_clientes",
    "editar_clientes",
    "crear_productos",
    "editar_productos",
    "activar_productos",
    "modificar_listas_precio",
  ],
  colaborador: [
    "crear_pedidos",
    "agregar_productos_pedido",
    "preparar_pedidos",
    "buscar_clientes",
    "crear_clientes",
    "editar_clientes",
    "crear_productos",
    "editar_productos",
    "activar_productos",
  ],
};

export const ETIQUETAS_MODULO: Record<Modulo, string> = {
  dashboard: "Dashboard",
  clientes: "Clientes",
  productos: "Productos",
  pedidos: "Pedidos",
  usuarios: "Usuarios",
  balance: "Balance",
};

export const ETIQUETAS_ROL: Record<RolUsuario, string> = {
  administrador: "Administrador",
  colaborador: "Colaborador",
};

export function normalizarRol(valor: string | null | undefined): RolUsuario | null {
  if (!valor) return null;

  const rol = valor.toLowerCase().trim();

  if (rol === "administrador" || rol === "admin") return "administrador";
  if (rol === "colaborador" || rol === "trabajador") return "colaborador";

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

export function puedeRealizarOperacion(
  rol: RolUsuario,
  operacion: PermisoOperacion
): boolean {
  return PERMISOS_OPERACION_POR_ROL[rol].includes(operacion);
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

  if (
    !rol ||
    typeof data.id !== "string" ||
    typeof data.usuario !== "string" ||
    typeof data.nombre !== "string"
  ) {
    return null;
  }

  return {
    id: data.id,
    nombre: data.nombre,
    usuario: data.usuario,
    rol,
    ...(typeof data.correo === "string" ? { correo: data.correo } : {}),
    ...(typeof data.activo === "boolean" ? { activo: data.activo } : {}),
  };
}
