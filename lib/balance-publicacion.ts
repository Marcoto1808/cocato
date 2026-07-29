import { supabase } from "@/lib/supabase";
import {
  PRODUCTOS_BALANCE,
  calcularCapoteTotal,
  calcularResultadosBalance,
  calcularValorCapoteTotal,
  calcularValorSubproductosTotal,
  parsearNumero,
  type PreciosState,
  type ProductoBalanceId,
} from "@/lib/balance";
import type { BalanceBorradorLocal } from "@/lib/balance-guardado";

export class PublicacionBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicacionBalanceError";
  }
}

type PrecioBalancePublicado = {
  producto_id: string;
  codigo: ProductoBalanceId;
  precio_publicado: number;
  precio_anterior: number | null;
};

export type ResultadoPublicacionBalance = {
  balanceId: string;
  listasPublicadas: number;
  publicadoEn: string;
};

function formatearNombreLista(fecha: string): string {
  const [year, month, day] = fecha.split("-");
  if (year && month && day) {
    return `Balance ${day}/${month}/${year}`;
  }
  return `Balance ${fecha}`;
}

async function obtenerMapaProductosBalance(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("productos")
    .select("id, codigo_balance")
    .not("codigo_balance", "is", null);

  if (error) {
    throw new PublicacionBalanceError(error.message);
  }

  const mapa = new Map<string, string>();

  for (const fila of data ?? []) {
    if (fila.codigo_balance) {
      mapa.set(fila.codigo_balance, fila.id);
    }
  }

  return mapa;
}

async function actualizarPreciosOficialesProductos(precios: PreciosState) {
  const mapaProductos = await obtenerMapaProductosBalance();

  for (const producto of PRODUCTOS_BALANCE) {
    const precio = parsearNumero(precios[producto.id]?.precioNuevo);
    if (precio === null) continue;

    const productoId = mapaProductos.get(producto.id);
    if (!productoId) continue;

    const { error } = await supabase
      .from("productos")
      .update({ precio_kg: Math.round(precio) })
      .eq("id", productoId);

    if (error) {
      throw new PublicacionBalanceError(
        `No se pudo actualizar el precio de ${producto.id}: ${error.message}`
      );
    }
  }
}

function extraerPreciosPublicados(
  borrador: BalanceBorradorLocal,
  mapaProductos: Map<string, string>
): PrecioBalancePublicado[] {
  const items: PrecioBalancePublicado[] = [];

  for (const producto of PRODUCTOS_BALANCE) {
    const precio = parsearNumero(borrador.preciosGuardados[producto.id]?.precioNuevo);
    if (precio === null) continue;

    const productoId = mapaProductos.get(producto.id);
    if (!productoId) {
      throw new PublicacionBalanceError(
        `Falta el producto de catálogo con codigo_balance "${producto.id}". Ejecuta sql/seed_productos.sql.`
      );
    }

    const anterior = parsearNumero(
      borrador.preciosAnteriores[producto.id]?.precio ?? ""
    );

    items.push({
      producto_id: productoId,
      codigo: producto.id,
      precio_publicado: Math.round(precio),
      precio_anterior: anterior !== null ? Math.round(anterior) : null,
    });
  }

  if (items.length === 0) {
    throw new PublicacionBalanceError(
      "Guarda los precios del balance antes de publicar."
    );
  }

  return items;
}

async function copiarItemsListaVigente(
  tipoClienteId: string
): Promise<Map<string, number>> {
  const { data: listaVigente, error: listaError } = await supabase
    .from("listas_precio")
    .select("id")
    .eq("tipo_cliente_id", tipoClienteId)
    .eq("es_vigente", true)
    .maybeSingle();

  if (listaError) {
    throw new PublicacionBalanceError(listaError.message);
  }

  if (!listaVigente) {
    return new Map();
  }

  const { data: items, error: itemsError } = await supabase
    .from("lista_precio_items")
    .select("producto_id, precio")
    .eq("lista_precio_id", listaVigente.id);

  if (itemsError) {
    throw new PublicacionBalanceError(itemsError.message);
  }

  return new Map(
    (items ?? []).map((item) => [item.producto_id, Number(item.precio)])
  );
}

async function archivarListaVigente(tipoClienteId: string) {
  const { error } = await supabase
    .from("listas_precio")
    .update({ es_vigente: false, estado: "archivada" })
    .eq("tipo_cliente_id", tipoClienteId)
    .eq("es_vigente", true);

  if (error) {
    throw new PublicacionBalanceError(error.message);
  }
}

function construirMetricasBalance(
  borrador: BalanceBorradorLocal,
  precioCanal: number | null
) {
  const preciosPorProducto = PRODUCTOS_BALANCE.reduce(
    (acc, producto) => {
      const valor = parsearNumero(borrador.preciosGuardados[producto.id]?.precioNuevo);
      if (valor !== null) acc[producto.id] = Math.round(valor);
      return acc;
    },
    {} as Partial<Record<ProductoBalanceId, number>>
  );

  const resultados = calcularResultadosBalance(
    borrador.compra,
    borrador.rendimientoParaPrecios,
    borrador.preciosGuardados,
    borrador.costoTotal
  );

  const valorCapote = calcularValorCapoteTotal(
    preciosPorProducto,
    borrador.rendimientoParaPrecios
  );
  const valorSubproductos = calcularValorSubproductosTotal(
    preciosPorProducto,
    borrador.rendimientoParaPrecios
  );

  return {
    costo_total: parsearNumero(borrador.costoTotal),
    capote_real_kg: parsearNumero(borrador.capoteRealParaPrecios),
    valor_capote: valorCapote,
    valor_subproductos: valorSubproductos,
    utilidad_total: resultados.utilidadTotal,
    utilidad_por_puerco: resultados.utilidadPorPuerco,
    margen_pct: resultados.margen,
    precio_canal: precioCanal,
    capote_calculado: calcularCapoteTotal(borrador.rendimientoParaPrecios),
  };
}

export async function publicarBalanceEnSupabase(
  borrador: BalanceBorradorLocal,
  precioCanal: number | null,
  opciones?: { balanceId?: string | null; publicadoPorId?: string | null }
): Promise<ResultadoPublicacionBalance> {
  const mapaProductos = await obtenerMapaProductosBalance();
  const preciosPublicados = extraerPreciosPublicados(borrador, mapaProductos);
  const publicadoEn = new Date().toISOString();
  const metricas = construirMetricasBalance(borrador, precioCanal);

  const payloadPublicado = {
    fecha: borrador.compra.fecha || new Date().toISOString().slice(0, 10),
    estado: "PUBLICADO" as const,
    numero_puercos: parsearNumero(borrador.compra.numeroPuercos),
    kilos_totales: parsearNumero(borrador.compra.kilosTotales),
    precio_compra_kg: parsearNumero(borrador.compra.precioCompraKg),
    gastos_adicionales: parsearNumero(borrador.compra.gastosAdicionales) ?? 0,
    costo_total: metricas.costo_total,
    capote_real_kg: metricas.capote_real_kg ?? metricas.capote_calculado,
    valor_capote: metricas.valor_capote,
    valor_subproductos: metricas.valor_subproductos,
    utilidad_total: metricas.utilidad_total,
    utilidad_por_puerco: metricas.utilidad_por_puerco,
    margen_pct: metricas.margen_pct,
    precio_canal: metricas.precio_canal,
    publicado_en: publicadoEn,
    publicado_por: opciones?.publicadoPorId ?? null,
  };

  let balanceId = opciones?.balanceId ?? null;

  if (balanceId) {
    const { data, error } = await supabase
      .from("balances")
      .update(payloadPublicado)
      .eq("id", balanceId)
      .eq("estado", "BORRADOR")
      .select("id")
      .single();

    if (error || !data) {
      balanceId = null;
    } else {
      balanceId = data.id;
    }
  }

  if (!balanceId) {
    const { data: balance, error: balanceError } = await supabase
      .from("balances")
      .insert(payloadPublicado)
      .select("id")
      .single();

    if (balanceError || !balance) {
      throw new PublicacionBalanceError(
        balanceError?.message ?? "No se pudo registrar el balance."
      );
    }

    balanceId = balance.id;
  }

  if (!balanceId) {
    throw new PublicacionBalanceError("No se pudo obtener el identificador del balance.");
  }

  const { error: deleteRendimientoError } = await supabase
    .from("balance_rendimiento")
    .delete()
    .eq("balance_id", balanceId);

  if (deleteRendimientoError) {
    throw new PublicacionBalanceError(deleteRendimientoError.message);
  }

  const rendimientoRows = PRODUCTOS_BALANCE.map((producto) => ({
    balance_id: balanceId,
    producto_id: mapaProductos.get(producto.id)!,
    kilos: parsearNumero(borrador.rendimientoParaPrecios[producto.id]) ?? 0,
  })).filter((row) => row.producto_id);

  if (rendimientoRows.length > 0) {
    const { error: rendimientoError } = await supabase
      .from("balance_rendimiento")
      .insert(rendimientoRows);

    if (rendimientoError) {
      throw new PublicacionBalanceError(rendimientoError.message);
    }
  }

  const { error: deletePreciosError } = await supabase
    .from("balance_precios")
    .delete()
    .eq("balance_id", balanceId);

  if (deletePreciosError) {
    throw new PublicacionBalanceError(deletePreciosError.message);
  }

  const { error: preciosBalanceError } = await supabase
    .from("balance_precios")
    .insert(
      preciosPublicados.map((item) => ({
        balance_id: balanceId,
        producto_id: item.producto_id,
        precio_anterior: item.precio_anterior,
        precio_publicado: item.precio_publicado,
      }))
    );

  if (preciosBalanceError) {
    throw new PublicacionBalanceError(preciosBalanceError.message);
  }

  await actualizarPreciosOficialesProductos(borrador.preciosGuardados);

  const { data: tiposCliente, error: tiposError } = await supabase
    .from("tipos_cliente")
    .select("id, nombre")
    .eq("activo", true)
    .order("orden");

  if (tiposError) {
    throw new PublicacionBalanceError(tiposError.message);
  }

  if (!tiposCliente?.length) {
    throw new PublicacionBalanceError("No hay tipos de cliente activos.");
  }

  let listasPublicadas = 0;
  let primeraListaId: string | null = null;

  for (const tipo of tiposCliente) {
    const itemsBase = await copiarItemsListaVigente(tipo.id);

    for (const precio of preciosPublicados) {
      itemsBase.set(precio.producto_id, precio.precio_publicado);
    }

    await archivarListaVigente(tipo.id);

    const { data: nuevaLista, error: listaError } = await supabase
      .from("listas_precio")
      .insert({
        tipo_cliente_id: tipo.id,
        nombre: formatearNombreLista(borrador.compra.fecha),
        estado: "publicada",
        es_vigente: true,
        origen: "balance",
        balance_id: balanceId,
        publicada_en: publicadoEn,
        publicada_por: opciones?.publicadoPorId ?? null,
      })
      .select("id")
      .single();

    if (listaError || !nuevaLista) {
      throw new PublicacionBalanceError(
        listaError?.message ?? `No se pudo crear la lista para ${tipo.nombre}.`
      );
    }

    if (!primeraListaId) {
      primeraListaId = nuevaLista.id;
    }

    const payloadItems = Array.from(itemsBase.entries()).map(
      ([producto_id, precio]) => ({
        lista_precio_id: nuevaLista.id,
        producto_id,
        precio,
      })
    );

    if (payloadItems.length > 0) {
      const { error: itemsError } = await supabase
        .from("lista_precio_items")
        .insert(payloadItems);

      if (itemsError) {
        throw new PublicacionBalanceError(itemsError.message);
      }
    }

    listasPublicadas += 1;
  }

  if (primeraListaId) {
    await supabase
      .from("balances")
      .update({ lista_precio_id: primeraListaId })
      .eq("id", balanceId);
  }

  return {
    balanceId,
    listasPublicadas,
    publicadoEn,
  };
}

export async function cargarUltimoBalancePublicado(): Promise<{
  precioCanal: number | null;
  publicadoEn: string;
  preciosPorCodigo: Partial<Record<ProductoBalanceId, number>>;
} | null> {
  const { data: balance, error: balanceError } = await supabase
    .from("balances")
    .select("id, precio_canal, publicado_en")
    .eq("estado", "PUBLICADO")
    .order("publicado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (balanceError || !balance?.publicado_en) {
    return null;
  }

  const { data: precios, error: preciosError } = await supabase
    .from("balance_precios")
    .select("precio_publicado, productos(codigo_balance)")
    .eq("balance_id", balance.id);

  if (preciosError) {
    return null;
  }

  const preciosPorCodigo: Partial<Record<ProductoBalanceId, number>> = {};

  for (const fila of precios ?? []) {
    const producto = Array.isArray(fila.productos)
      ? fila.productos[0]
      : fila.productos;
    const codigo = producto?.codigo_balance as ProductoBalanceId | undefined;

    if (codigo) {
      preciosPorCodigo[codigo] = Number(fila.precio_publicado);
    }
  }

  return {
    precioCanal: balance.precio_canal !== null ? Number(balance.precio_canal) : null,
    publicadoEn: balance.publicado_en,
    preciosPorCodigo,
  };
}
