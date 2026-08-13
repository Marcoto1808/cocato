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
  listarProductosCompletos,
  type ProductoCatalogo,
} from "../repositories/product.repository.ts";
import type { ClienteResuelto } from "../types.ts";
import {
  type LineaCarrito,
  mensajeOriginalDesdeCarrito,
} from "../conversation/cart.ts";
import {
  esLineaLibre,
  esLineaPendienteDisambiguacion,
} from "../openai/linea-libre.ts";
import { cantidadCapturadaDesdeLineaPedido } from "../openai/cantidad-natural.ts";
import {
  extraerTextoProductoParaValidacionLibre,
  resolverProductoTextoLibrePedidoGuiado,
} from "../conversation/pedido-guiado-productos.ts";
import { resolverProductoEnCatalogo } from "../openai/resolver-producto.ts";

function esTipoCalculo(valor: string | null): valor is TipoCalculoProducto {
  return (
    valor === "POR_KILO" ||
    valor === "POR_PESO_REAL" ||
    valor === "PRECIO_FIJO"
  );
}

export async function construirLineasDesdeCarrito(
  db: SupabaseClient,
  cliente: ClienteResuelto,
  lineasCarrito: LineaCarrito[],
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

  const productosMap = new Map(productos.map((producto) => [producto.id, producto]));
  const resultado: LineaPedidoInsert[] = [];

  for (const linea of lineasCarrito) {
    if (esLineaPendienteDisambiguacion(linea.producto_id)) {
      return { error: "Hay productos pendientes de confirmar en su pedido." };
    }

    let producto: ProductoCatalogo | null = null;

    if (esLineaLibre(linea.producto_id)) {
      producto = resolverProductoTextoLibrePedidoGuiado(
        linea.textoOriginal?.trim() || linea.producto_nombre,
        productos
      );
    } else {
      producto = productosMap.get(linea.producto_id) ?? null;
      if (!producto) {
        const { data: productoDb } = await db
          .from("productos")
          .select("id, nombre, unidad, precio_kg, activo, tipo_calculo, categoria")
          .eq("id", linea.producto_id)
          .eq("activo", true)
          .maybeSingle();
        if (productoDb) {
          producto = productoDb as ProductoCatalogo;
        }
      }
    }

    if (!producto) {
      return { error: `Producto no disponible: ${linea.producto_nombre}` };
    }

    const captura = cantidadCapturadaDesdeLineaPedido({
      cantidad: linea.cantidad,
      cantidadTexto: linea.cantidadTexto,
      textoOriginal: linea.textoOriginal,
    });
    const esImporte = captura.tipo === "importe";
    const unidadCaptura =
      linea.unidad === "kg" ? "kg" : producto.unidad === "kg" ? "kg" : "pieza";
    const tipoCalculo = esTipoCalculo(producto.tipo_calculo)
      ? producto.tipo_calculo
      : tipoCalculoPorDefecto(producto.unidad);

    resultado.push(
      crearLineaPedido({
        producto_id: producto.id,
        unidadProducto: producto.unidad,
        tipo_calculo: tipoCalculo,
        cantidad: esImporte ? 1 : linea.cantidad,
        unidadCaptura,
        precioLista: precioProductoParaPedido(preciosLista, producto),
        cantidadTexto: esImporte ? captura.cantidad_texto : null,
      })
    );
  }

  return {
    lineas: resultado,
    total: calcularTotalLineas(resultado),
  };
}

async function construirLineasDesdeNombres(
  db: SupabaseClient,
  cliente: ClienteResuelto,
  lineas: Array<{
    producto_id?: string;
    producto_nombre: string;
    cantidad: number;
    unidad: "kg" | "pieza";
    cantidad_texto?: string | null;
    texto_original?: string | null;
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

  const productosMap = new Map(productos.map((producto) => [producto.id, producto]));
  const resultado: LineaPedidoInsert[] = [];

  for (const linea of lineas) {
    let producto =
      (linea.producto_id ? productosMap.get(linea.producto_id) : null) ?? null;

    if (!producto) {
      const textoProducto =
        extraerTextoProductoParaValidacionLibre(
          linea.texto_original ?? linea.producto_nombre
        ) || linea.producto_nombre;
      const resolucion = resolverProductoEnCatalogo(textoProducto, productos);
      if (resolucion.tipo !== "ok") {
        return { error: `Producto no reconocido: ${textoProducto}` };
      }
      producto = resolucion.producto;
    }

    const captura = cantidadCapturadaDesdeLineaPedido({
      cantidad: linea.cantidad,
      cantidadTexto: linea.cantidad_texto,
      textoOriginal: linea.texto_original ?? linea.producto_nombre,
    });
    const esImporte = captura.tipo === "importe";
    const unidadCaptura =
      linea.unidad === "kg" ? "kg" : producto.unidad === "kg" ? "kg" : "pieza";
    const tipoCalculo = esTipoCalculo(producto.tipo_calculo)
      ? producto.tipo_calculo
      : tipoCalculoPorDefecto(producto.unidad);

    resultado.push(
      crearLineaPedido({
        producto_id: producto.id,
        unidadProducto: producto.unidad,
        tipo_calculo: tipoCalculo,
        cantidad: esImporte ? 1 : linea.cantidad,
        unidadCaptura,
        precioLista: precioProductoParaPedido(preciosLista, producto),
        cantidadTexto: esImporte ? captura.cantidad_texto : null,
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

  const productos = await listarProductosCompletos(db);

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

  const lineasResultado = await construirLineasDesdeCarrito(
    db,
    input.cliente,
    input.lineas,
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

  return {
    ok: true as const,
    pedidoId: pedido.id as string,
    total: lineasResultado.total,
    totalFormateado: formatMoneda(lineasResultado.total),
  };
}
