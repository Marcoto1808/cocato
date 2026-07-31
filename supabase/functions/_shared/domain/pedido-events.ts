/** Eventos de dominio — extensión futura: pagos, inventario, repartidores. */

export type PedidoCreadoEvento = {
  tipo: "pedido_creado";
  pedidoId: string;
  clienteId: string;
  origen: "whatsapp";
  total: number;
};

export type PedidoEvento = PedidoCreadoEvento;

const listeners: Array<(evento: PedidoEvento) => void | Promise<void>> = [];

export function suscribirPedidoEventos(
  listener: (evento: PedidoEvento) => void | Promise<void>
) {
  listeners.push(listener);
}

export async function emitirPedidoEvento(evento: PedidoEvento) {
  for (const listener of listeners) {
    try {
      await listener(evento);
    } catch (error) {
      console.error("[pedido-events]", error);
    }
  }
}

// Stubs para fases futuras
export async function onPedidoCreado(_evento: PedidoCreadoEvento) {
  // pagos.service.ts — cobro anticipado, links de pago
  // inventario.service.ts — reservar stock
  // reparto.service.ts — asignar repartidor
}
