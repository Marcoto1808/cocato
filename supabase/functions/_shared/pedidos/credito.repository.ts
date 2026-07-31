import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const MAX_NOTAS_PENDIENTES = 3;
const MENSAJE_CREDITO_EXCEDIDO =
  "Este cliente excedió su límite de crédito. Registra un pago o aumenta su límite antes de generar un nuevo pedido.";

function esPedidoEntregado(estado: string): boolean {
  return estado.toLowerCase().trim() === "entregado";
}

function esNotaPendientePago(pedido: {
  estado: string;
  estado_pago: string | null;
}): boolean {
  if (!esPedidoEntregado(pedido.estado)) return false;
  const pago = pedido.estado_pago?.toLowerCase().trim();
  return pago !== "pagado";
}

export async function evaluarCreditoCliente(
  db: SupabaseClient,
  clienteId: string,
  limiteCredito: number
): Promise<{ permitido: boolean; mensaje?: string }> {
  const { data, error } = await db
    .from("pedidos")
    .select("id, total, estado, estado_pago, fecha, pagado_en")
    .eq("cliente_id", clienteId)
    .order("fecha", { ascending: false });

  if (error) throw new Error(error.message);

  const pedidos = data ?? [];
  const pendientes = pedidos.filter(esNotaPendientePago);
  const saldoPendiente = pendientes.reduce(
    (acc, p) => acc + Number(p.total ?? 0),
    0
  );

  if (pendientes.length >= MAX_NOTAS_PENDIENTES) {
    return { permitido: false, mensaje: MENSAJE_CREDITO_EXCEDIDO };
  }

  if (saldoPendiente >= limiteCredito) {
    return { permitido: false, mensaje: MENSAJE_CREDITO_EXCEDIDO };
  }

  return { permitido: true };
}

export { MENSAJE_CREDITO_EXCEDIDO };
