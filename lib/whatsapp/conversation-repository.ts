import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizarTelefonoWa } from "@/lib/whatsapp/phone-utils";
import {
  parsearCarritoConversacion,
  type CarritoConversacion,
} from "@/lib/whatsapp/conversation-cart";

export async function obtenerOCrearConversacion(
  db: SupabaseClient,
  waPhone: string,
  clienteId: string | null
) {
  const phone = normalizarTelefonoWa(waPhone);

  const { data: existente, error: errorBusqueda } = await db
    .from("whatsapp_conversations")
    .select("id, cliente_id, wa_phone, estado_comercial, carrito_json")
    .eq("wa_phone", phone)
    .maybeSingle();

  if (errorBusqueda) {
    throw new Error(errorBusqueda.message);
  }

  if (existente) {
    if (clienteId && existente.cliente_id !== clienteId) {
      await db
        .from("whatsapp_conversations")
        .update({ cliente_id: clienteId })
        .eq("id", existente.id);
    }

    return existente;
  }

  const { data, error } = await db
    .from("whatsapp_conversations")
    .insert({
      wa_phone: phone,
      cliente_id: clienteId,
      estado: "activa",
      estado_comercial: "NUEVA",
      ultimo_mensaje_en: new Date().toISOString(),
    })
    .select("id, cliente_id, wa_phone, estado_comercial, carrito_json")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear la conversación.");
  }

  return data;
}

export async function actualizarUltimoMensajeConversacion(
  db: SupabaseClient,
  conversationId: string
) {
  const { error } = await db
    .from("whatsapp_conversations")
    .update({ ultimo_mensaje_en: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function obtenerCarritoConversacion(
  db: SupabaseClient,
  conversationId: string
): Promise<CarritoConversacion> {
  const { data, error } = await db
    .from("whatsapp_conversations")
    .select("carrito_json")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return parsearCarritoConversacion(data?.carrito_json);
}

export async function guardarCarritoConversacion(
  db: SupabaseClient,
  conversationId: string,
  carrito: CarritoConversacion
): Promise<void> {
  const { error } = await db
    .from("whatsapp_conversations")
    .update({ carrito_json: carrito })
    .eq("id", conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function actualizarEstadoYCarritoConversacion(
  db: SupabaseClient,
  conversationId: string,
  input: { estadoComercial?: string; carrito?: CarritoConversacion }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (input.estadoComercial !== undefined) {
    payload.estado_comercial = input.estadoComercial;
  }
  if (input.carrito !== undefined) {
    payload.carrito_json = input.carrito;
  }

  if (Object.keys(payload).length === 0) return;

  const { error } = await db
    .from("whatsapp_conversations")
    .update(payload)
    .eq("id", conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export type UltimoPedidoCliente = {
  pedidoId: string;
  mensajeOriginal: string | null;
  lineas: Array<{
    producto_id: string;
    producto_nombre: string;
    cantidad: number;
    unidad: "kg" | "pieza";
    textoOriginal: string;
  }>;
};

export async function obtenerUltimoPedidoCliente(
  db: SupabaseClient,
  clienteId: string
): Promise<UltimoPedidoCliente | null> {
  const { data: pedido, error } = await db
    .from("pedidos")
    .select("id, mensaje_original")
    .eq("cliente_id", clienteId)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!pedido) return null;

  const { data: detalle, error: detalleError } = await db
    .from("detalle_pedido")
    .select(
      "producto_id, cantidad_solicitada, unidad, productos(nombre)"
    )
    .eq("pedido_id", pedido.id);

  if (detalleError) {
    throw new Error(detalleError.message);
  }

  const lineas = (detalle ?? []).flatMap((row) => {
    const productoRaw = row.productos as
      | { nombre?: string }
      | Array<{ nombre?: string }>
      | null;
    const productoNombre = Array.isArray(productoRaw)
      ? productoRaw[0]?.nombre
      : productoRaw?.nombre;
    if (!productoNombre) return [];

    const unidad: "kg" | "pieza" = row.unidad === "kg" ? "kg" : "pieza";
    const cantidad = Number(row.cantidad_solicitada);
    if (!Number.isFinite(cantidad) || cantidad <= 0) return [];

    const unidadTexto = unidad === "kg" ? "kg" : "pza";
    return [
      {
        producto_id: row.producto_id as string,
        producto_nombre: productoNombre,
        cantidad,
        unidad,
        textoOriginal: `${cantidad} ${unidadTexto} ${productoNombre}`,
      },
    ];
  });

  if (lineas.length === 0) return null;

  return {
    pedidoId: pedido.id as string,
    mensajeOriginal: (pedido.mensaje_original as string | null) ?? null,
    lineas,
  };
}

export async function vincularClienteConversacion(
  db: SupabaseClient,
  conversationId: string,
  clienteId: string
): Promise<void> {
  const { error } = await db
    .from("whatsapp_conversations")
    .update({ cliente_id: clienteId })
    .eq("id", conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function actualizarDireccionCliente(
  db: SupabaseClient,
  clienteId: string,
  direccion: string
): Promise<void> {
  const { error } = await db
    .from("clientes")
    .update({ direccion: direccion.trim() })
    .eq("id", clienteId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function obtenerDireccionCliente(
  db: SupabaseClient,
  clienteId: string
): Promise<string | null> {
  const { data, error } = await db
    .from("clientes")
    .select("direccion")
    .eq("id", clienteId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const direccion = (data?.direccion as string | null)?.trim();
  return direccion || null;
}

export async function actualizarEstadoComercialConversacion(
  db: SupabaseClient,
  conversationId: string,
  estadoComercial: string
) {
  const { error } = await db
    .from("whatsapp_conversations")
    .update({ estado_comercial: estadoComercial })
    .eq("id", conversationId);

  if (error) {
    throw new Error(error.message);
  }
}
