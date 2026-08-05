import { supabase } from "@/lib/supabase";

const SELECT_PEDIDOS_TABLERO =
  "id, cliente_id, estado, fecha, updated_at, total, origen, mensaje_original, cliente_nombre_temporal, clientes(nombre_negocio), detalle_pedido(count)";

const SELECT_PEDIDOS_TABLERO_LEGACY =
  "id, cliente_id, estado, fecha, updated_at, total, mensaje_original, cliente_nombre_temporal, clientes(nombre_negocio), detalle_pedido(count)";

const SELECT_PEDIDO_DETALLE =
  "id, estado, fecha, origen, mensaje_original, observaciones, total, cliente_nombre_temporal, cliente_telefono_temporal, clientes(nombre_negocio, propietario, direccion), detalle_pedido(id, producto_id, cantidad_solicitada, cantidad_texto, unidad, tipo_calculo, peso_real, precio_lista, precio_aplicado, precio_modificado, subtotal, productos(nombre))";

const SELECT_PEDIDO_DETALLE_LEGACY =
  "id, estado, fecha, mensaje_original, observaciones, total, cliente_nombre_temporal, cliente_telefono_temporal, clientes(nombre_negocio, propietario, direccion), detalle_pedido(id, producto_id, cantidad_solicitada, cantidad_texto, unidad, tipo_calculo, peso_real, precio_lista, precio_aplicado, precio_modificado, subtotal, productos(nombre))";

function faltaColumnaOrigen(mensaje: string | undefined): boolean {
  if (!mensaje) return false;
  const normalizado = mensaje.toLowerCase();
  return normalizado.includes("origen") && normalizado.includes("does not exist");
}

/** Carga pedidos para el tablero; reintenta sin `origen` si la migración no se aplicó. */
export async function cargarPedidosTablero() {
  const consulta = await supabase
    .from("pedidos")
    .select(SELECT_PEDIDOS_TABLERO)
    .order("fecha", { ascending: false });

  if (consulta.error && faltaColumnaOrigen(consulta.error.message)) {
    return supabase
      .from("pedidos")
      .select(SELECT_PEDIDOS_TABLERO_LEGACY)
      .order("fecha", { ascending: false });
  }

  return consulta;
}

/** Carga un pedido por id; reintenta sin `origen` si la migración no se aplicó. */
export async function cargarPedidoDetalle(id: string) {
  const consulta = await supabase
    .from("pedidos")
    .select(SELECT_PEDIDO_DETALLE)
    .eq("id", id)
    .single();

  if (consulta.error && faltaColumnaOrigen(consulta.error.message)) {
    return supabase
      .from("pedidos")
      .select(SELECT_PEDIDO_DETALLE_LEGACY)
      .eq("id", id)
      .single();
  }

  return consulta;
}
