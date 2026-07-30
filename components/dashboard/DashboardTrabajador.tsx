import Link from "next/link";
import type { ReactNode } from "react";
import { esMismoDiaCalendario } from "@/lib/pedido-fecha";
import { normalizarEstado } from "@/lib/pedido-estados";

export type ResumenPedidosDashboard = {
  pendientes: number;
  listos: number;
  entregadosHoy: number;
};

type Props = {
  resumenPedidos: ResumenPedidosDashboard;
  totalClientes: number;
  clientesNuevosHoy: number;
  productosActivos: number;
  ultimaActualizacionPrecios: string | null;
};

function formatFechaCorta(fechaIso: string) {
  return new Date(fechaIso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TarjetaEnlace({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl bg-white shadow-md ring-1 ring-zinc-200 transition active:scale-[0.98] hover:bg-zinc-50 hover:shadow-lg ${className}`}
    >
      {children}
    </Link>
  );
}

function LineaEstadistica({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: string | number;
  destacado?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${
        destacado ? "rounded-xl bg-blue-50 px-4 py-3" : ""
      }`}
    >
      <span className="text-lg font-medium text-zinc-600 sm:text-xl">
        {etiqueta}
      </span>
      <span
        className={`font-bold tabular-nums ${
          destacado
            ? "text-3xl text-blue-700 sm:text-4xl"
            : "text-2xl text-zinc-900 sm:text-3xl"
        }`}
      >
        {valor}
      </span>
    </div>
  );
}

export default function DashboardTrabajador({
  resumenPedidos,
  totalClientes,
  clientesNuevosHoy,
  productosActivos,
  ultimaActualizacionPrecios,
}: Props) {
  const sinPedidosActivos =
    resumenPedidos.pendientes + resumenPedidos.listos === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <TarjetaEnlace
        href="/dashboard/pedidos"
        className="ring-2 ring-blue-500 shadow-lg"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="text-5xl leading-none sm:text-6xl" aria-hidden>
              📦
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold uppercase tracking-wide text-zinc-900 sm:text-3xl">
                Pedidos
              </h2>
              {sinPedidosActivos ? (
                <p className="mt-4 text-xl font-semibold text-emerald-600 sm:text-2xl">
                  ✅ Sin pedidos pendientes
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <LineaEstadistica
              etiqueta="Pendientes"
              valor={resumenPedidos.pendientes}
              destacado={resumenPedidos.pendientes > 0}
            />
            <LineaEstadistica
              etiqueta="Listos"
              valor={resumenPedidos.listos}
            />
            <LineaEstadistica
              etiqueta="Entregados hoy"
              valor={resumenPedidos.entregadosHoy}
            />
          </div>
        </div>
      </TarjetaEnlace>

      <div className="grid gap-4 sm:grid-cols-2">
        <TarjetaEnlace href="/clientes">
          <div className="p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="text-4xl leading-none sm:text-5xl" aria-hidden>
                👥
              </span>
              <h2 className="text-xl font-bold uppercase tracking-wide text-zinc-900 sm:text-2xl">
                Clientes
              </h2>
            </div>
            <div className="mt-5 space-y-3">
              <LineaEstadistica
                etiqueta="Total de clientes"
                valor={totalClientes}
              />
              {clientesNuevosHoy > 0 ? (
                <LineaEstadistica
                  etiqueta="Nuevos hoy"
                  valor={clientesNuevosHoy}
                />
              ) : null}
            </div>
          </div>
        </TarjetaEnlace>

        <TarjetaEnlace href="/productos">
          <div className="p-6 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="text-4xl leading-none sm:text-5xl" aria-hidden>
                🥩
              </span>
              <h2 className="text-xl font-bold uppercase tracking-wide text-zinc-900 sm:text-2xl">
                Productos
              </h2>
            </div>
            <div className="mt-5 space-y-3">
              <LineaEstadistica
                etiqueta="Productos activos"
                valor={productosActivos}
              />
              <div className="pt-1">
                <p className="text-base font-medium text-zinc-500 sm:text-lg">
                  Última actualización de precios
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 sm:text-xl">
                  {ultimaActualizacionPrecios
                    ? formatFechaCorta(ultimaActualizacionPrecios)
                    : "Sin registro"}
                </p>
              </div>
            </div>
          </div>
        </TarjetaEnlace>
      </div>
    </div>
  );
}

export function contarPedidosDashboard(
  pedidos: Array<{ estado: string; updated_at: string }>
): ResumenPedidosDashboard {
  return pedidos.reduce(
    (acc, pedido) => {
      const categoria = normalizarEstado(pedido.estado);

      if (categoria === "pendiente") acc.pendientes += 1;
      if (categoria === "listo") acc.listos += 1;
      if (
        categoria === "entregado" &&
        esMismoDiaCalendario(pedido.updated_at)
      ) {
        acc.entregadosHoy += 1;
      }

      return acc;
    },
    { pendientes: 0, listos: 0, entregadosHoy: 0 }
  );
}

export function contarClientesNuevosHoy(
  clientes: Array<{ created_at: string }>
): number {
  return clientes.filter((cliente) =>
    esMismoDiaCalendario(cliente.created_at)
  ).length;
}
