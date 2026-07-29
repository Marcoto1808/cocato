import { supabase } from "@/lib/supabase";
import { esNotaPendientePago } from "@/lib/pedido-pago";

export const LIMITE_CREDITO_POR_CODIGO: Record<string, number> = {
  fonda: 5000,
  carniceria: 10000,
  restaurante: 10000,
};

export const MENSAJE_CREDITO_EXCEDIDO =
  "Este cliente excedió su límite de crédito. Registra un pago o aumenta su límite antes de generar un nuevo pedido.";

export const MAX_NOTAS_PENDIENTES = 3;

export type PedidoCredito = {
  id: string;
  total: number;
  estado: string;
  estado_pago: string | null;
  fecha: string;
  pagado_en: string | null;
};

export type ResumenCreditoCliente = {
  saldoPendiente: number;
  limiteCredito: number;
  creditoDisponible: number;
  notasPendientes: number;
  ultimoPedido: { fecha: string; total: number } | null;
  ultimoPago: { fecha: string; total: number } | null;
};

export function limiteCreditoDefault(codigoTipo: string | null | undefined): number {
  if (!codigoTipo) return 10000;
  return LIMITE_CREDITO_POR_CODIGO[codigoTipo.toLowerCase()] ?? 10000;
}

export function calcularResumenCredito(
  pedidos: PedidoCredito[],
  limiteCredito: number
): ResumenCreditoCliente {
  const pendientes = pedidos.filter(esNotaPendientePago);
  const saldoPendiente = pendientes.reduce(
    (acc, pedido) => acc + Number(pedido.total ?? 0),
    0
  );

  const pedidosOrdenados = [...pedidos].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  const ultimoPedido = pedidosOrdenados[0]
    ? {
        fecha: pedidosOrdenados[0].fecha,
        total: Number(pedidosOrdenados[0].total ?? 0),
      }
    : null;

  const pagados = pedidos
    .filter((pedido) => pedido.pagado_en)
    .sort(
      (a, b) =>
        new Date(b.pagado_en!).getTime() - new Date(a.pagado_en!).getTime()
    );

  const ultimoPago = pagados[0]
    ? {
        fecha: pagados[0].pagado_en!,
        total: Number(pagados[0].total ?? 0),
      }
    : null;

  const creditoDisponible = Math.max(0, limiteCredito - saldoPendiente);

  return {
    saldoPendiente,
    limiteCredito,
    creditoDisponible,
    notasPendientes: pendientes.length,
    ultimoPedido,
    ultimoPago,
  };
}

export function clientePuedeCrearPedido(resumen: ResumenCreditoCliente): {
  permitido: boolean;
  mensaje?: string;
} {
  if (resumen.notasPendientes >= MAX_NOTAS_PENDIENTES) {
    return { permitido: false, mensaje: MENSAJE_CREDITO_EXCEDIDO };
  }

  if (resumen.saldoPendiente >= resumen.limiteCredito) {
    return { permitido: false, mensaje: MENSAJE_CREDITO_EXCEDIDO };
  }

  return { permitido: true };
}

export function clienteCreditoBloqueado(
  resumen: ResumenCreditoCliente
): boolean {
  return !clientePuedeCrearPedido(resumen).permitido;
}

export async function cargarPedidosCreditoCliente(
  clienteId: string
): Promise<PedidoCredito[]> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, total, estado, estado_pago, fecha, pagado_en")
    .eq("cliente_id", clienteId)
    .order("fecha", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as PedidoCredito[];
}

export async function evaluarCreditoCliente(
  clienteId: string,
  limiteCredito: number
): Promise<{ permitido: boolean; mensaje?: string; resumen: ResumenCreditoCliente }> {
  const pedidos = await cargarPedidosCreditoCliente(clienteId);
  const resumen = calcularResumenCredito(pedidos, limiteCredito);
  const validacion = clientePuedeCrearPedido(resumen);

  return {
    ...validacion,
    resumen,
  };
}

export function numeroPedidoCliente(
  indice: number,
  totalPedidos: number
): number {
  return totalPedidos - indice;
}

export type EstadoCreditoCartera =
  | "al_corriente"
  | "pendiente"
  | "bloqueado";

export type PedidoCreditoConCliente = PedidoCredito & {
  cliente_id: string;
};

export type ClienteCartera = {
  id: string;
  nombre_negocio: string;
  tipoCliente: string;
  resumen: ResumenCreditoCliente;
  estadoCredito: EstadoCreditoCartera;
};

export type ResumenCartera = {
  totalClientes: number;
  clientesConAdeudo: number;
  clientesBloqueados: number;
  totalPorCobrar: number;
};

export function estadoCreditoCartera(
  resumen: ResumenCreditoCliente
): EstadoCreditoCartera {
  if (clienteCreditoBloqueado(resumen)) return "bloqueado";
  if (resumen.notasPendientes > 0) return "pendiente";
  return "al_corriente";
}

export function etiquetaEstadoCreditoCartera(
  estado: EstadoCreditoCartera
): string {
  switch (estado) {
    case "al_corriente":
      return "🟢 Al corriente";
    case "pendiente":
      return "🟡 Pendiente";
    case "bloqueado":
      return "🔴 Crédito bloqueado";
  }
}

export function agruparPedidosPorCliente(
  pedidos: PedidoCreditoConCliente[]
): Map<string, PedidoCredito[]> {
  const mapa = new Map<string, PedidoCredito[]>();

  for (const pedido of pedidos) {
    const actuales = mapa.get(pedido.cliente_id) ?? [];
    actuales.push(pedido);
    mapa.set(pedido.cliente_id, actuales);
  }

  return mapa;
}

export function construirCarteraClientes(
  clientes: Array<{
    id: string;
    nombre_negocio: string;
    limite_credito: number;
    tipos_cliente: { nombre: string } | { nombre: string }[] | null;
  }>,
  pedidosPorCliente: Map<string, PedidoCredito[]>
): ClienteCartera[] {
  return clientes.map((cliente) => {
    const pedidos = pedidosPorCliente.get(cliente.id) ?? [];
    const limite = Number(cliente.limite_credito ?? 0);
    const resumen = calcularResumenCredito(pedidos, limite);
    const tipo = Array.isArray(cliente.tipos_cliente)
      ? (cliente.tipos_cliente[0]?.nombre ?? "—")
      : (cliente.tipos_cliente?.nombre ?? "—");

    return {
      id: cliente.id,
      nombre_negocio: cliente.nombre_negocio,
      tipoCliente: tipo,
      resumen,
      estadoCredito: estadoCreditoCartera(resumen),
    };
  });
}

export function calcularResumenCartera(
  cartera: ClienteCartera[]
): ResumenCartera {
  return {
    totalClientes: cartera.length,
    clientesConAdeudo: cartera.filter(
      (cliente) => cliente.resumen.saldoPendiente > 0
    ).length,
    clientesBloqueados: cartera.filter(
      (cliente) => cliente.estadoCredito === "bloqueado"
    ).length,
    totalPorCobrar: cartera.reduce(
      (acc, cliente) => acc + cliente.resumen.saldoPendiente,
      0
    ),
  };
}
