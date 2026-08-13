import type { SupabaseClient } from "@supabase/supabase-js";
import { obtenerInterpretadorMensajes } from "@/lib/interpretacion/mensaje-interpreter-factory";
import type { LineaInterpretada } from "@/lib/interpretacion/mensaje-interpreter";
import { esLineaLibre, esLineaPendienteDisambiguacion } from "@/lib/interpretacion/linea-libre";
import { resolverProductoTextoLibrePedidoGuiado } from "@/lib/whatsapp/pedido-guiado-productos";
import { calcularTotalLineas } from "@/lib/pedido-calculo";
import { crearLineaPedidoDesdeProducto } from "@/lib/pedidos/pedido-linea";
import { crearPedido } from "@/lib/pedidos/pedido-service";
import type { LineaPedidoInput } from "@/lib/pedidos/pedido-types";
import {
  cargarPreciosLista,
  combinarPreciosConCatalogo,
  precioProductoParaPedido,
  resolverListaPrecioCliente,
} from "@/lib/lista-precio-vigente";
import {
  esTipoCalculoProducto,
  tipoCalculoPorDefecto,
} from "@/lib/tipo-calculo-producto";
import { cantidadCapturadaDesdeLineaPedido } from "@/lib/interpretacion/cantidad-natural";
import type { LineaCarrito } from "@/lib/whatsapp/conversation-cart";
import { mensajeOriginalDesdeCarrito } from "@/lib/whatsapp/conversation-cart";
import type { ClienteResuelto } from "@/lib/whatsapp/client-resolver";

type ProductoDb = {
  id: string;
  nombre: string;
  unidad: string;
  precio_kg: number;
  activo: boolean;
  tipo_calculo: string | null;
  categoria: string | null;
};

export async function construirLineasPedidoDesdeInterpretacion(
  db: SupabaseClient,
  cliente: ClienteResuelto,
  lineasInterpretadas: LineaInterpretada[]
): Promise<{ lineas: LineaPedidoInput[]; total: number } | { error: string }> {
  const { data: productosDb, error: productosError } = await db
    .from("productos")
    .select("id, nombre, unidad, precio_kg, activo, tipo_calculo, categoria")
    .eq("activo", true);

  if (productosError) {
    return { error: productosError.message };
  }

  const productos = (productosDb ?? []) as ProductoDb[];
  const productosMap = new Map(productos.map((producto) => [producto.id, producto]));

  const { lista, error: listaError } = await resolverListaPrecioCliente(
    cliente.tipo_cliente_id,
    cliente.lista_precio_id,
    db
  );

  if (listaError) {
    return { error: listaError };
  }

  const preciosLista = lista
    ? await cargarPreciosLista(lista.id, db)
    : new Map<string, number>();

  const precios = combinarPreciosConCatalogo(preciosLista, productos);

  const lineas: LineaPedidoInput[] = [];

  for (const interpretada of lineasInterpretadas) {
    if (esLineaPendienteDisambiguacion(interpretada.producto_id)) {
      continue;
    }

    let producto = productosMap.get(interpretada.producto_id) ?? null;
    if (!producto && esLineaLibre(interpretada.producto_id)) {
      const resuelto = resolverProductoTextoLibrePedidoGuiado(
        interpretada.textoOriginal?.trim() || interpretada.producto_id,
        productos.map((item) => ({
          id: item.id,
          nombre: item.nombre,
          categoria: item.categoria ?? "",
          unidad: item.unidad,
        }))
      );
      producto = resuelto ? (productosMap.get(resuelto.id) ?? null) : null;
    }
    if (!producto) {
      return { error: `Producto no disponible: ${interpretada.producto_id}` };
    }

    const precioLista = precioProductoParaPedido(precios, producto);
    const tipoCalculo = esTipoCalculoProducto(producto.tipo_calculo)
      ? producto.tipo_calculo
      : tipoCalculoPorDefecto(producto.unidad);

    const parsed = cantidadCapturadaDesdeLineaPedido({
      cantidad: interpretada.cantidad,
      cantidadTexto: interpretada.cantidadTexto,
      textoOriginal: interpretada.textoOriginal,
    });

    const linea = crearLineaPedidoDesdeProducto(
      {
        id: producto.id,
        nombre: producto.nombre,
        unidad: producto.unidad,
        tipo_calculo: tipoCalculo,
      },
      precioLista,
      parsed,
      interpretada.unidad
    );

    lineas.push(linea);
  }

  const total = calcularTotalLineas(lineas.map((linea) => ({ subtotal: linea.subtotal })));

  return { lineas, total };
}

export async function crearPedidoDesdeMensajeWhatsApp(
  db: SupabaseClient,
  input: {
    cliente: ClienteResuelto;
    mensajeOriginal: string;
    listaPrecioId: string | null;
  }
) {
  const { data: productosDb, error: productosError } = await db
    .from("productos")
    .select("id, nombre, unidad, precio_kg, activo")
    .eq("activo", true);

  if (productosError) {
    return { ok: false as const, error: productosError.message };
  }

  const interpretador = obtenerInterpretadorMensajes();
  const interpretacion = await interpretador.interpretar({
    texto: input.mensajeOriginal,
    productos: (productosDb ?? []) as Array<{
      id: string;
      nombre: string;
      unidad: string;
      precio_kg: number;
      activo: boolean;
    }>,
  });

  if (interpretacion.tipo === "referencia_historica") {
    return {
      ok: false as const,
      error: interpretacion.motivo,
      requiereIa: true,
    };
  }

  if (interpretacion.tipo !== "pedido") {
    return {
      ok: false as const,
      error: interpretacion.motivo,
      requiereIa: false,
    };
  }

  const lineasResultado = await construirLineasPedidoDesdeInterpretacion(
    db,
    input.cliente,
    interpretacion.lineas
  );

  if ("error" in lineasResultado) {
    return { ok: false as const, error: lineasResultado.error, requiereIa: false };
  }

  const resultado = await crearPedido(db, {
    origen: "whatsapp",
    cliente_id: input.cliente.id,
    tipo_cliente_id: input.cliente.tipo_cliente_id,
    lista_precio_id: input.listaPrecioId,
    mensaje_original: input.mensajeOriginal,
    observaciones: null,
    total: lineasResultado.total,
    lineas: lineasResultado.lineas,
    validarCredito: true,
    limite_credito: Number(input.cliente.limite_credito ?? 0),
  });

  if (!resultado.ok) {
    return { ok: false as const, error: resultado.error, requiereIa: false };
  }

  return { ok: true as const, pedidoId: resultado.pedidoId };
}

/** Confirma el pedido usando las líneas ya validadas del carrito (no re-parsea el mensaje). */
export async function crearPedidoDesdeCarritoWhatsApp(
  db: SupabaseClient,
  input: {
    cliente: ClienteResuelto;
    lineas: LineaCarrito[];
    mensajeOriginal: string;
    listaPrecioId: string | null;
  }
) {
  if (input.lineas.length === 0) {
    return { ok: false as const, error: "Su pedido está vacío.", requiereIa: false };
  }

  for (const linea of input.lineas) {
    if (esLineaPendienteDisambiguacion(linea.producto_id)) {
      return {
        ok: false as const,
        error: "Hay productos pendientes de confirmar en su pedido.",
        requiereIa: false,
      };
    }
  }

  const lineasInterpretadas: LineaInterpretada[] = input.lineas.map((linea) => ({
    producto_id: linea.producto_id,
    cantidad: linea.cantidad,
    unidad: linea.unidad,
    textoOriginal: linea.textoOriginal,
    cantidadTexto: linea.cantidadTexto,
  }));

  const lineasResultado = await construirLineasPedidoDesdeInterpretacion(
    db,
    input.cliente,
    lineasInterpretadas
  );

  if ("error" in lineasResultado) {
    return { ok: false as const, error: lineasResultado.error, requiereIa: false };
  }

  const resultado = await crearPedido(db, {
    origen: "whatsapp",
    cliente_id: input.cliente.id,
    tipo_cliente_id: input.cliente.tipo_cliente_id,
    lista_precio_id: input.listaPrecioId,
    mensaje_original: input.mensajeOriginal,
    observaciones: null,
    total: lineasResultado.total,
    lineas: lineasResultado.lineas,
    validarCredito: true,
    limite_credito: Number(input.cliente.limite_credito ?? 0),
  });

  if (!resultado.ok) {
    return { ok: false as const, error: resultado.error, requiereIa: false };
  }

  return { ok: true as const, pedidoId: resultado.pedidoId };
}
