import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { emitirPedidoEvento } from "../domain/pedido-events.ts";
import { interpretarMensajeSimple } from "../openai/reglas-simples.ts";
import {
  calcularTotalLineas,
  crearLineaPedido,
  formatMoneda,
  type LineaPedidoInsert,
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
  listarProductosCompletos,
  type ProductoCatalogo,
} from "../repositories/product.repository.ts";
import type { ClienteResuelto } from "../types.ts";

function esTipoCalculo(valor: string | null): valor is TipoCalculoProducto {
  return (
    valor === "POR_KILO" ||
    valor === "POR_PESO_REAL" ||
    valor === "PRECIO_FIJO"
  );
}

async function construirLineasDesdeNombres(
  db: SupabaseClient,
  cliente: ClienteResuelto,
  lineas: Array<{
    producto_nombre: string;
    cantidad: number;
    unidad: "kg" | "pieza";
  }>,
  productos: ProductoCatalogo[]
): Promise<{ lineas: LineaPedidoInsert[]; total: number } | { error: string }> {
  const lista = await resolverListaPrecioCliente(
    db,
    cliente.tipo_cliente_id,
    cliente.lista_precio_id
  );

  const preciosLista = lista
    ? await cargarPreciosLista(db, lista.id)
    : new Map<string, number>();

  const resultado: LineaPedidoInsert[] = [];

  for (const linea of lineas) {
    const producto = buscarProductoPorNombre(linea.producto_nombre, productos);
    if (!producto) {
      return { error: `Producto no reconocido: ${linea.producto_nombre}` };
    }

    const unidadCaptura = linea.unidad === "kg" ? "kg" : producto.unidad === "kg" ? "kg" : "pieza";
    const tipoCalculo = esTipoCalculo(producto.tipo_calculo)
      ? producto.tipo_calculo
      : tipoCalculoPorDefecto(producto.unidad);
    const precioLista = precioProductoParaPedido(preciosLista, producto);

    resultado.push(
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

  return {
    lineas: resultado,
    total: calcularTotalLineas(resultado),
  };
}

/** Equivalente Edge de crearPedidoDesdeMensajeWhatsApp (Next.js). */
export async function crearPedidoDesdeMensajeWhatsApp(
  db: SupabaseClient,
  input: {
    cliente: ClienteResuelto;
    mensajeOriginal: string;
    listaPrecioId: string | null;
  }
) {
  const productos = await listarProductosCompletos(db);
  const interpretacion = interpretarMensajeSimple({
    mensaje: input.mensajeOriginal,
    productos,
    nombreCliente: input.cliente.nombre_negocio,
  });

  if (!interpretacion.ok) {
    return {
      ok: false as const,
      error: interpretacion.motivo,
      requiereIa: interpretacion.motivo.includes("interpretación avanzada"),
    };
  }

  const analisis = interpretacion.analisis;

  const credito = await evaluarCreditoCliente(
    db,
    input.cliente.id,
    Number(input.cliente.limite_credito ?? 0)
  );

  if (!credito.permitido) {
    return {
      ok: false as const,
      error: credito.mensaje ?? MENSAJE_CREDITO_EXCEDIDO,
      requiereIa: false,
    };
  }

  const lineasResultado = await construirLineasDesdeNombres(
    db,
    input.cliente,
    analisis.lineas,
    productos
  );

  if ("error" in lineasResultado) {
    return { ok: false as const, error: lineasResultado.error, requiereIa: false };
  }

  const { data: pedido, error: pedidoError } = await db
    .from("pedidos")
    .insert({
      cliente_id: input.cliente.id,
      tipo_cliente_id: input.cliente.tipo_cliente_id,
      lista_precio_id: input.listaPrecioId,
      estado: "Pendiente",
      fecha: new Date().toISOString(),
      mensaje_original: input.mensajeOriginal,
      observaciones: null,
      total: lineasResultado.total,
      origen: "whatsapp",
    })
    .select("id")
    .single();

  if (pedidoError || !pedido) {
    return {
      ok: false as const,
      error: pedidoError?.message ?? "No se pudo crear el pedido.",
      requiereIa: false,
    };
  }

  const detalle = lineasResultado.lineas.map((linea) => ({
    pedido_id: pedido.id,
    ...linea,
  }));

  const { error: detalleError } = await db.from("detalle_pedido").insert(detalle);

  if (detalleError) {
    await db.from("pedidos").delete().eq("id", pedido.id);
    return { ok: false as const, error: detalleError.message, requiereIa: false };
  }

  await emitirPedidoEvento({
    tipo: "pedido_creado",
    pedidoId: pedido.id,
    clienteId: input.cliente.id,
    origen: "whatsapp",
    total: lineasResultado.total,
  });

  const resumen = analisis.lineas
    .map((linea) => `${linea.cantidad} ${linea.unidad === "kg" ? "kg" : "pza"} ${linea.producto_nombre}`)
    .join(", ");

  return {
    ok: true as const,
    pedidoId: pedido.id as string,
    total: lineasResultado.total,
    resumen,
    totalFormateado: formatMoneda(lineasResultado.total),
  };
}
