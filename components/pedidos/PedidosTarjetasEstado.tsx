"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatMoneda } from "@/lib/pedido-calculo";
import type { EstadoCategoria } from "@/lib/pedido-estados";

export type PedidoResumenTarjeta = {
  id: string;
  nombreCliente: string;
  total: number | null;
  lineas: number;
  fecha: string;
};

export type FiltroTarjetaEstado = {
  clave: EstadoCategoria;
  etiqueta: string;
  contador: number;
  color: string;
  anillo: string;
};

type Props = {
  filtros: FiltroTarjetaEstado[];
  pedidosPorEstado: Record<EstadoCategoria, PedidoResumenTarjeta[]>;
};

function formatFechaCorta(fecha: string) {
  return new Date(fecha).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}

function EntregarPedidoButton({ pedidoId }: { pedidoId: string }) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  async function handleEntregar(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (cargando) return;

    setCargando(true);

    const { error } = await supabase
      .from("pedidos")
      .update({ estado: "Entregado", estado_pago: "pendiente" })
      .eq("id", pedidoId);

    setCargando(false);

    if (!error) {
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleEntregar}
      disabled={cargando}
      className="shrink-0 self-stretch rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-md ring-2 ring-emerald-500/30 transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[9.5rem] sm:text-base"
    >
      {cargando ? "Guardando..." : "Entregado"}
    </button>
  );
}

export default function PedidosTarjetasEstado({
  filtros,
  pedidosPorEstado,
}: Props) {
  const [expandido, setExpandido] = useState<EstadoCategoria | null>(null);

  function alternarTarjeta(clave: EstadoCategoria) {
    setExpandido((actual) => (actual === clave ? null : clave));
  }

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {filtros.map((filtro) => {
        const activo = expandido === filtro.clave;
        const pedidos = pedidosPorEstado[filtro.clave];

        return (
          <div
            key={filtro.clave}
            className={activo ? "col-span-1 sm:col-span-3" : undefined}
          >
            <button
              type="button"
              onClick={() => alternarTarjeta(filtro.clave)}
              aria-expanded={activo}
              className={`w-full rounded-xl bg-white p-5 text-left shadow-sm transition hover:shadow-md ${
                activo
                  ? `ring-2 ${filtro.anillo}`
                  : "ring-1 ring-zinc-200 hover:ring-zinc-300"
              }`}
            >
              <p className="text-sm text-zinc-500">{filtro.etiqueta}</p>
              <p className={`mt-2 text-3xl font-bold ${filtro.color}`}>
                {filtro.contador}
              </p>
            </button>

            {activo ? (
              <div className="mt-3 space-y-2">
                {pedidos.length > 0 ? (
                  pedidos.map((pedido, indice) =>
                    filtro.clave === "entregado" ? (
                      <Link
                        key={pedido.id}
                        href={`/dashboard/pedidos/${pedido.id}`}
                        className="block rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50"
                      >
                        <p className="font-semibold text-zinc-900">
                          Pedido {indice + 1}
                        </p>
                      </Link>
                    ) : (
                      <div
                        key={pedido.id}
                        className="flex items-stretch gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200"
                      >
                        <Link
                          href={`/dashboard/pedidos/${pedido.id}`}
                          className="min-w-0 flex-1 rounded-lg transition hover:bg-zinc-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="truncate font-semibold text-zinc-900">
                              Pedido {indice + 1}
                            </p>
                            <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">
                              {formatMoneda(pedido.total ?? 0)}
                            </p>
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {pedido.nombreCliente} · {pedido.lineas} producto
                            {pedido.lineas === 1 ? "" : "s"} ·{" "}
                            {formatFechaCorta(pedido.fecha)}
                          </p>
                        </Link>
                        {filtro.clave === "listo" ? (
                          <EntregarPedidoButton pedidoId={pedido.id} />
                        ) : null}
                      </div>
                    )
                  )
                ) : (
                  <p className="rounded-xl bg-white px-4 py-3 text-sm text-zinc-500 ring-1 ring-zinc-200">
                    {filtro.clave === "entregado"
                      ? "No hay pedidos entregados hoy."
                      : "No hay pedidos en este estado."}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
