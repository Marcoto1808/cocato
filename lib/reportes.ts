import { supabase } from "@/lib/supabase";
import {
  agruparPedidosPorCliente,
  calcularResumenCartera,
  construirCarteraClientes,
  etiquetaEstadoCreditoCartera,
  type ClienteCartera,
} from "@/lib/cliente-credito";
import { esPedidoEntregado } from "@/lib/pedido-estados";
import { pedidoEnRango, type RangoFechas } from "@/lib/reportes-periodo";

export type PedidoReporte = {
  id: string;
  cliente_id: string;
  estado: string;
  fecha: string;
  total: number;
  clientes: { nombre_negocio: string } | { nombre_negocio: string }[] | null;
};

export type DetalleReporte = {
  pedido_id: string;
  producto_id: string;
  cantidad_solicitada: number;
  unidad: string;
  peso_real: number | null;
  subtotal: number;
  productos: { nombre: string } | { nombre: string }[] | null;
};

export type BalanceReporte = {
  utilidad_total: number | null;
  margen_pct: number | null;
  publicado_en: string | null;
  fecha: string;
};

export type ProductoVendidoFila = {
  producto: string;
  cantidadVendida: number;
  totalVendido: number;
};

export type ClienteCompraFila = {
  cliente: string;
  pedidos: number;
  totalComprado: number;
};

export type CobranzaReporteFila = {
  cliente: string;
  saldoPendiente: number;
  limiteCredito: number;
  estado: string;
};

export type IndicadoresReporte = {
  ventas: {
    total: number;
    pedidos: number;
    ticketPromedio: number;
  };
  productos: {
    masVendido: string;
    kilosVendidos: number;
    totalVendido: number;
  };
  clientes: {
    mayorCompra: string;
    pedidos: number;
    totalComprado: number;
  };
  cobranza: {
    totalPendiente: number;
    clientesConAdeudo: number;
    clientesBloqueados: number;
  };
  balance: {
    utilidadEstimada: number;
    margenPromedio: number;
  };
  tablas: {
    productos: ProductoVendidoFila[];
    clientes: ClienteCompraFila[];
    cobranza: CobranzaReporteFila[];
  };
};

function resolverJoin<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function kilosLinea(detalle: DetalleReporte): number {
  if (detalle.unidad === "kg") {
    return Number(detalle.peso_real ?? detalle.cantidad_solicitada ?? 0);
  }
  if (detalle.peso_real !== null) {
    return Number(detalle.peso_real);
  }
  return 0;
}

function cantidadVendidaLinea(detalle: DetalleReporte): number {
  if (detalle.unidad === "kg") {
    return kilosLinea(detalle);
  }
  return Number(detalle.peso_real ?? detalle.cantidad_solicitada ?? 0);
}

export function calcularIndicadoresReporte(
  pedidos: PedidoReporte[],
  detalles: DetalleReporte[],
  balances: BalanceReporte[],
  cartera: ClienteCartera[],
  rango: RangoFechas
): IndicadoresReporte {
  const pedidosEntregados = pedidos.filter(
    (pedido) =>
      esPedidoEntregado(pedido.estado) && pedidoEnRango(pedido.fecha, rango)
  );

  const ventaTotal = pedidosEntregados.reduce(
    (acc, pedido) => acc + Number(pedido.total ?? 0),
    0
  );
  const numeroPedidos = pedidosEntregados.length;
  const ticketPromedio =
    numeroPedidos > 0 ? ventaTotal / numeroPedidos : 0;

  const pedidosIds = new Set(pedidosEntregados.map((pedido) => pedido.id));
  const detallesPeriodo = detalles.filter((detalle) =>
    pedidosIds.has(detalle.pedido_id)
  );

  const productosMap = new Map<
    string,
    { nombre: string; cantidad: number; total: number }
  >();

  let kilosVendidos = 0;
  let totalVendidoProductos = 0;

  for (const detalle of detallesPeriodo) {
    const producto = resolverJoin(detalle.productos);
    const nombre = producto?.nombre ?? "Producto";
    const cantidad = cantidadVendidaLinea(detalle);
    const subtotal = Number(detalle.subtotal ?? 0);

    kilosVendidos += kilosLinea(detalle);
    totalVendidoProductos += subtotal;

    const actual = productosMap.get(detalle.producto_id) ?? {
      nombre,
      cantidad: 0,
      total: 0,
    };
    actual.cantidad += cantidad;
    actual.total += subtotal;
    productosMap.set(detalle.producto_id, actual);
  }

  const productosOrdenados = Array.from(productosMap.values()).sort(
    (a, b) => b.total - a.total
  );

  const clientesMap = new Map<
    string,
    { nombre: string; pedidos: number; total: number }
  >();

  for (const pedido of pedidosEntregados) {
    const cliente = resolverJoin(pedido.clientes);
    const nombre = cliente?.nombre_negocio ?? "Cliente";
    const actual = clientesMap.get(pedido.cliente_id) ?? {
      nombre,
      pedidos: 0,
      total: 0,
    };
    actual.pedidos += 1;
    actual.total += Number(pedido.total ?? 0);
    clientesMap.set(pedido.cliente_id, actual);
  }

  const clientesOrdenados = Array.from(clientesMap.values()).sort(
    (a, b) => b.total - a.total
  );

  const mayorCliente = clientesOrdenados[0];
  const resumenCartera = calcularResumenCartera(cartera);

  const balancesPeriodo = balances.filter((balance) => {
    const referencia = balance.publicado_en ?? balance.fecha;
    return referencia ? pedidoEnRango(referencia, rango) : false;
  });

  const utilidadEstimada = balancesPeriodo.reduce(
    (acc, balance) => acc + Number(balance.utilidad_total ?? 0),
    0
  );
  const margenes = balancesPeriodo
    .map((balance) => Number(balance.margen_pct ?? 0))
    .filter((valor) => Number.isFinite(valor));
  const margenPromedio =
    margenes.length > 0
      ? margenes.reduce((acc, valor) => acc + valor, 0) / margenes.length
      : 0;

  return {
    ventas: {
      total: ventaTotal,
      pedidos: numeroPedidos,
      ticketPromedio,
    },
    productos: {
      masVendido: productosOrdenados[0]?.nombre ?? "—",
      kilosVendidos,
      totalVendido: totalVendidoProductos,
    },
    clientes: {
      mayorCompra: mayorCliente?.nombre ?? "—",
      pedidos: mayorCliente?.pedidos ?? 0,
      totalComprado: mayorCliente?.total ?? 0,
    },
    cobranza: {
      totalPendiente: resumenCartera.totalPorCobrar,
      clientesConAdeudo: resumenCartera.clientesConAdeudo,
      clientesBloqueados: resumenCartera.clientesBloqueados,
    },
    balance: {
      utilidadEstimada,
      margenPromedio,
    },
    tablas: {
      productos: productosOrdenados.map((producto) => ({
        producto: producto.nombre,
        cantidadVendida: producto.cantidad,
        totalVendido: producto.total,
      })),
      clientes: clientesOrdenados.map((cliente) => ({
        cliente: cliente.nombre,
        pedidos: cliente.pedidos,
        totalComprado: cliente.total,
      })),
      cobranza: cartera
        .filter((cliente) => cliente.resumen.saldoPendiente > 0)
        .sort((a, b) => b.resumen.saldoPendiente - a.resumen.saldoPendiente)
        .map((cliente) => ({
          cliente: cliente.nombre_negocio,
          saldoPendiente: cliente.resumen.saldoPendiente,
          limiteCredito: cliente.resumen.limiteCredito,
          estado: etiquetaEstadoCreditoCartera(cliente.estadoCredito),
        })),
    },
  };
}

export async function cargarDatosReporte(): Promise<{
  pedidos: PedidoReporte[];
  detalles: DetalleReporte[];
  balances: BalanceReporte[];
  cartera: ClienteCartera[];
}> {
  const [pedidosRes, detallesRes, balancesRes, clientesRes, pedidosCreditoRes] =
    await Promise.all([
      supabase
        .from("pedidos")
        .select("id, cliente_id, estado, fecha, total, clientes(nombre_negocio)"),
      supabase
        .from("detalle_pedido")
        .select(
          "pedido_id, producto_id, cantidad_solicitada, unidad, peso_real, subtotal, productos(nombre)"
        ),
      supabase
        .from("balances")
        .select("utilidad_total, margen_pct, publicado_en, fecha")
        .eq("estado", "PUBLICADO"),
      supabase
        .from("clientes")
        .select("id, nombre_negocio, limite_credito, tipos_cliente(nombre)")
        .eq("activo", true),
      supabase
        .from("pedidos")
        .select(
          "id, cliente_id, total, estado, estado_pago, fecha, pagado_en"
        ),
    ]);

  if (
    pedidosRes.error ||
    detallesRes.error ||
    balancesRes.error ||
    clientesRes.error ||
    pedidosCreditoRes.error
  ) {
    throw new Error("No se pudieron cargar los datos del reporte.");
  }

  const pedidosPorCliente = agruparPedidosPorCliente(
    (pedidosCreditoRes.data ?? []).map((pedido) => ({
      id: pedido.id,
      cliente_id: pedido.cliente_id,
      total: Number(pedido.total ?? 0),
      estado: pedido.estado,
      estado_pago: pedido.estado_pago,
      fecha: pedido.fecha,
      pagado_en: pedido.pagado_en,
    }))
  );

  const cartera = construirCarteraClientes(
    clientesRes.data ?? [],
    pedidosPorCliente
  );

  return {
    pedidos: (pedidosRes.data ?? []) as PedidoReporte[],
    detalles: (detallesRes.data ?? []) as DetalleReporte[],
    balances: (balancesRes.data ?? []) as BalanceReporte[],
    cartera,
  };
}
