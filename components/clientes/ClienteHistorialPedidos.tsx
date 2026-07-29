"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { numeroPedidoCliente } from "@/lib/cliente-credito";
import { formatMoneda } from "@/lib/pedido-calculo";
import { etiquetaEstado } from "@/lib/pedido-estados";
import {
  esNotaPendientePago,
  normalizarEstadoPago,
  puedeRegistrarPago,
} from "@/lib/pedido-pago";
import type { PedidoCredito } from "@/lib/cliente-credito";

type Props = {
  pedidos: PedidoCredito[];
  onPagoRegistrado: (pedidoId: string, pagadoEn: string) => void;
};

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function BotonEstadoPago({
  pedido,
  registrando,
  onRegistrar,
}: {
  pedido: PedidoCredito;
  registrando: boolean;
  onRegistrar: () => void;
}) {
  const pagado = normalizarEstadoPago(pedido.estado_pago) === "pagado";
  const pendienteCobro = puedeRegistrarPago(pedido);

  if (pagado) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800">
        🟢 Pagado
      </span>
    );
  }

  if (pendienteCobro) {
    return (
      <button
        type="button"
        onClick={onRegistrar}
        disabled={registrando}
        title="Registrar pago"
        className="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {registrando ? "Guardando..." : "🔴 Pendiente"}
      </button>
    );
  }

  if (esNotaPendientePago(pedido)) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700">
        🔴 Pendiente
      </span>
    );
  }

  return <span className="text-sm text-zinc-400">—</span>;
}

export default function ClienteHistorialPedidos({
  pedidos,
  onPagoRegistrado,
}: Props) {
  const [registrandoId, setRegistrandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function registrarPago(pedidoId: string) {
    setRegistrandoId(pedidoId);
    setError(null);

    const pagadoEn = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("pedidos")
      .update({
        estado_pago: "pagado",
        pagado_en: pagadoEn,
      })
      .eq("id", pedidoId);

    setRegistrandoId(null);

    if (updateError) {
      setError("No se pudo registrar el pago. Intenta de nuevo.");
      return;
    }

    onPagoRegistrado(pedidoId, pagadoEn);
  }

  if (pedidos.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 text-sm text-zinc-500 shadow-sm ring-1 ring-zinc-200">
        Este cliente aún no tiene pedidos registrados.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">
          Historial de pedidos
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Toca 🔴 Pendiente para registrar el pago.
        </p>
      </div>

      {error ? (
        <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px]">
          <thead className="bg-zinc-100">
            <tr>
              <th className="p-3 text-left text-sm font-medium text-zinc-600">
                Pedido
              </th>
              <th className="p-3 text-left text-sm font-medium text-zinc-600">
                Fecha
              </th>
              <th className="p-3 text-left text-sm font-medium text-zinc-600">
                Total
              </th>
              <th className="p-3 text-left text-sm font-medium text-zinc-600">
                Estado
              </th>
              <th className="p-3 text-left text-sm font-medium text-zinc-600">
                Pago
              </th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((pedido, indice) => (
              <tr key={pedido.id} className="border-t border-zinc-100">
                <td className="p-3 font-medium text-zinc-900">
                  <Link
                    href={`/dashboard/pedidos/${pedido.id}`}
                    className="hover:underline"
                  >
                    Pedido {numeroPedidoCliente(indice, pedidos.length)}
                  </Link>
                </td>
                <td className="p-3 text-zinc-700">
                  {formatFecha(pedido.fecha)}
                </td>
                <td className="p-3 text-zinc-900">
                  {formatMoneda(Number(pedido.total ?? 0))}
                </td>
                <td className="p-3 text-zinc-700">
                  {etiquetaEstado(pedido.estado)}
                </td>
                <td className="p-3">
                  <BotonEstadoPago
                    pedido={pedido}
                    registrando={registrandoId === pedido.id}
                    onRegistrar={() => registrarPago(pedido.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
