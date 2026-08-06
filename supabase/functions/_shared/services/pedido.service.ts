import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { emitirPedidoEvento } from "../domain/pedido-events.ts";
import { analizarMensajeParaPedido } from "../openai/extract-pedido.ts";
import { interpretarMensajeSimple } from "../openai/reglas-simples.ts";
import {
  calcularTotalLineas,
  crearLineaPedido,
  formatMoneda,
  type LineaPedidoInsert,
  normalizarUnidadCaptura,
  tipoCalculoPorDefecto,
  type TipoCalculoProducto,
} from "../pedidos/calculo.ts";
import {
  evaluarCreditoCliente,
  MENSAJE_CREDITO_EXCEDIDO,
} from "../pedidos/credito.repository.ts";
import {
  cargarPreciosLista,
  precioProductoParaPedido,
  resolverListaPrecioCliente,
} from "../pedidos/lista-precio.repository.ts";
import {
  buscarProductoPorNombre,
  catalogoParaPrompt,
  listarProductosCompletos,
  type ProductoCatalogo,
} from "../repositories/product.repository.ts";
import type { ClienteResuelto, MensajeHistorial } from "../types.ts";

export type ResultadoProcesamientoPedido =
  | {
      tipo: "conversacion";
      respuesta: string;
      pedidoId?: undefined;
    }
  | {
      tipo: "pedido_creado";
      respuesta: string;
      pedidoId: string;
      total: number;
    }
  | {
      tipo: "error_credito";
      respuesta: string;
    }
  | {
      tipo: "error_productos";
      respuesta: string;
    };

function esTipoCalculo(valor: string | null): valor is TipoCalculoProducto {
  return (
    valor === "POR_KILO" ||
    valor === "POR_PESO_REAL" ||
    valor === "PRECIO_FIJO"
  );
}

function resolverUnidadCaptura(
  producto: ProductoCatalogo,
  unidadSolicitada: "kg" | "pieza"
): "kg" | "pieza" {
  if (unidadSolicitada === "kg") return "kg";
  return producto.unidad === "kg" ? "kg" : "pieza";
}

async function construirLineasPedido(
  db: SupabaseClient,
  cliente: ClienteCompleto,
  lineasIA: Array<{
    producto_nombre: string;
    cantidad: number;
    unidad: "kg" | "pieza";
  }>,
  productos: ProductoCatalogo[]
): Promise<{ lineas: LineaPedidoInsert[] } | { error: string }> {
  const lista = await resolverListaPrecioCliente(
    db,
    cliente.tipo_cliente_id,
    cliente.lista_precio_id
  );

  const preciosLista = lista
    ? await cargarPreciosLista(db, lista.id)
    : new Map<string, number>();

  const lineas: LineaPedidoInsert[] = [];
  const noEncontrados: string[] = [];

  for (const linea of lineasIA) {
    if (!Number.isFinite(linea.cantidad) || linea.cantidad <= 0) {
      return { error: `Cantidad inválida para "${linea.producto_nombre}".` };
    }

    const producto = buscarProductoPorNombre(linea.producto_nombre, productos);
    if (!producto) {
      noEncontrados.push(linea.producto_nombre);
      continue;
    }

    const unidadCaptura = resolverUnidadCaptura(producto, linea.unidad);
    const tipoCalculo = esTipoCalculo(producto.tipo_calculo)
      ? producto.tipo_calculo
      : tipoCalculoPorDefecto(producto.unidad);
    const precioLista = precioProductoParaPedido(preciosLista, producto);

    lineas.push(
      crearLineaPedido({
        producto_id: producto.id,
        unidadProducto: producto.unidad,
        tipo_calculo: tipoCalculo,
        cantidad: linea.cantidad,
        unidadCaptura,
        precioLista,
      })
    );
  }

  if (noEncontrados.length > 0) {
    return {
      error: `No reconocí estos productos: ${noEncontrados.join(", ")}. Revisa el catálogo.`,
    };
  }

  if (lineas.length === 0) {
    return { error: "No se pudo armar ninguna línea del pedido." };
  }

  return { lineas };
}

async function insertarPedido(
  db: SupabaseClient,
  input: {
    cliente: ClienteCompleto;
    mensajeOriginal: string;
    observaciones: string | null;
    lineas: LineaPedidoInsert[];
    listaPrecioId: string | null;
  }
): Promise<{ pedidoId: string; total: number } | { error: string }> {
  const total = calcularTotalLineas(input.lineas);

  const { data: pedido, error: pedidoError } = await db
    .from("pedidos")
    .insert({
      cliente_id: input.cliente.id,
      tipo_cliente_id: input.cliente.tipo_cliente_id,
      lista_precio_id: input.listaPrecioId,
      estado: "Pendiente",
      fecha: new Date().toISOString(),
      mensaje_original: input.mensajeOriginal,
      observaciones: input.observaciones,
      total,
      origen: "whatsapp",
    })
    .select("id")
    .single();

  if (pedidoError || !pedido) {
    return { error: pedidoError?.message ?? "No se pudo crear el pedido." };
  }

  const detalle = input.lineas.map((linea) => ({
    pedido_id: pedido.id,
    ...linea,
  }));

  const { error: detalleError } = await db.from("detalle_pedido").insert(detalle);

  if (detalleError) {
    await db.from("pedidos").delete().eq("id", pedido.id);
    return { error: detalleError.message };
  }

  return { pedidoId: pedido.id, total };
}

export type ClienteCompleto = ClienteResuelto & {
  tipo_cliente_id: string;
  lista_precio_id: string | null;
  limite_credito: number;
};

export async function procesarMensajeConPedido(input: {
  db: SupabaseClient;
  cliente: ClienteCompleto;
  mensajeOriginal: string;
  historial: MensajeHistorial[];
}): Promise<ResultadoProcesamientoPedido> {
  const productos = await listarProductosCompletos(input.db);
  const catalogoTexto = catalogoParaPrompt(productos);

  let analisis;
  try {
    analisis = await analizarMensajeParaPedido({
      mensajeUsuario: input.mensajeOriginal,
      historial: input.historial,
      catalogoTexto,
      nombreCliente: input.cliente.nombre_negocio,
    });
  } catch (error) {
    const detalle =
      error instanceof Error ? error.message : "Error al consultar OpenAI.";
    console.warn("[pedido] OpenAI falló, intentando reglas simples:", detalle);

    const fallback = interpretarMensajeSimple({
      mensaje: input.mensajeOriginal,
      productos,
      nombreCliente: input.cliente.nombre_negocio,
    });

    if (!fallback.ok) {
      throw error;
    }

    analisis = fallback.analisis;
  }

  if (!analisis.es_pedido || analisis.lineas.length === 0) {
    return {
      tipo: "conversacion",
      respuesta: analisis.respuesta_cliente,
    };
  }

  const credito = await evaluarCreditoCliente(
    input.db,
    input.cliente.id,
    Number(input.cliente.limite_credito ?? 0)
  );

  if (!credito.permitido) {
    return {
      tipo: "error_credito",
      respuesta:
        credito.mensaje ??
        MENSAJE_CREDITO_EXCEDIDO,
    };
  }

  const lineasResultado = await construirLineasPedido(
    input.db,
    input.cliente,
    analisis.lineas,
    productos
  );

  if ("error" in lineasResultado) {
    return {
      tipo: "error_productos",
      respuesta: `${lineasResultado.error} ${analisis.respuesta_cliente}`.trim(),
    };
  }

  const lista = await resolverListaPrecioCliente(
    input.db,
    input.cliente.tipo_cliente_id,
    input.cliente.lista_precio_id
  );

  const insertado = await insertarPedido(input.db, {
    cliente: input.cliente,
    mensajeOriginal: input.mensajeOriginal,
    observaciones: analisis.observaciones,
    lineas: lineasResultado.lineas,
    listaPrecioId: lista?.id ?? null,
  });

  if ("error" in insertado) {
    return {
      tipo: "error_productos",
      respuesta: `No pude registrar el pedido: ${insertado.error}`,
    };
  }

  await emitirPedidoEvento({
    tipo: "pedido_creado",
    pedidoId: insertado.pedidoId,
    clienteId: input.cliente.id,
    origen: "whatsapp",
    total: insertado.total,
  });

  const resumenLineas = analisis.lineas
    .map((l) => {
      const u = normalizarUnidadCaptura(l.unidad);
      return `${l.cantidad} ${u === "kg" ? "kg" : "pza"} ${l.producto_nombre}`;
    })
    .join(", ");

  const respuesta =
    analisis.respuesta_cliente.includes("registr")
      ? analisis.respuesta_cliente
      : `${analisis.respuesta_cliente}\n\n✅ Pedido registrado: ${resumenLineas}.\nTotal estimado: ${formatMoneda(insertado.total)}.`;

  return {
    tipo: "pedido_creado",
    respuesta,
    pedidoId: insertado.pedidoId,
    total: insertado.total,
  };
}
