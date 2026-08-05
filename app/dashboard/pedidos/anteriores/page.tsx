import Link from "next/link";
import { esPedidoEntregado, etiquetaEstado } from "@/lib/pedido-estados";
import { formatMoneda } from "@/lib/pedido-calculo";
import { formatFechaCortaMx } from "@/lib/pedido-fecha";
import { nombreMostrarPedido } from "@/lib/pedido-rapido";
import { cargarPedidosTablero } from "@/lib/pedidos/pedidos-lista";
import EliminarPedidoButton from "./EliminarPedidoButton";

export const dynamic = "force-dynamic";

type ClienteJoin = {
  nombre_negocio: string;
};

type Pedido = {
  id: string;
  cliente_id: string | null;
  estado: string;
  fecha: string;
  total: number | null;
  cliente_nombre_temporal: string | null;
  clientes: ClienteJoin | ClienteJoin[] | null;
  detalle_pedido: { count: number }[] | { count: number } | null;
};

function contarLineas(detalle: Pedido["detalle_pedido"]): number {
  if (!detalle) return 0;
  if (Array.isArray(detalle)) return detalle[0]?.count ?? 0;
  return detalle.count ?? 0;
}

function nombreCliente(pedido: Pedido) {
  return nombreMostrarPedido(pedido);
}

export default async function PedidosAnterioresPage({
  searchParams,
}: {
  searchParams: Promise<{ eliminado?: string; actualizado?: string }>;
}) {
  const { eliminado, actualizado } = await searchParams;

  const { data: pedidos, error } = await cargarPedidosTablero();

  if (error) {
    console.error("[pedidos/anteriores] Error al cargar historial:", error);
    return (
      <main className="min-h-screen bg-zinc-100 p-8">
        <Link
          href="/dashboard/pedidos"
          className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Volver a Pedidos
        </Link>
        <h1 className="mb-6 text-3xl font-bold">Pedidos anteriores</h1>
        <div className="rounded-xl bg-white p-6 shadow">
          <p className="text-red-600">Error al cargar el historial.</p>
          <p className="mt-2 text-sm text-zinc-500">{error.message}</p>
        </div>
      </main>
    );
  }

  const lista = ((pedidos ?? []) as Pedido[]).filter((pedido) =>
    esPedidoEntregado(pedido.estado)
  );

  return (
    <main className="min-h-screen bg-zinc-100 p-8">
      <Link
        href="/dashboard/pedidos"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Volver a Pedidos
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Pedidos anteriores</h1>
        <p className="mt-1 text-zinc-500">
          Pedidos entregados archivados
        </p>
      </div>

      {eliminado && (
        <div className="mb-6 rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          Pedido eliminado correctamente
        </div>
      )}

      {actualizado && (
        <div className="mb-6 rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          Pedido archivado como {decodeURIComponent(actualizado)}
        </div>
      )}

      {lista.length > 0 ? (
        <div className="mx-auto max-w-2xl space-y-3">
          {lista.map((pedido) => {
            const lineas = contarLineas(pedido.detalle_pedido);

            return (
              <article
                key={pedido.id}
                className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200"
              >
                <Link
                  href={`/dashboard/pedidos/${pedido.id}`}
                  className="block px-6 py-5 transition hover:bg-zinc-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xl font-bold text-zinc-900">
                        {nombreCliente(pedido)}
                      </p>
                      <p className="mt-2 text-sm font-medium text-zinc-700">
                        {etiquetaEstado(pedido.estado)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xl font-bold text-zinc-900">
                        {formatMoneda(pedido.total ?? 0)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {lineas} producto{lineas === 1 ? "" : "s"} ·{" "}
                        {formatFechaCortaMx(pedido.fecha)}
                      </p>
                    </div>
                  </div>
                </Link>

                <div className="border-t border-zinc-100 px-6 py-4">
                  <EliminarPedidoButton pedidoId={pedido.id} />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <p className="text-zinc-600">No hay pedidos entregados en el historial.</p>
        </div>
      )}
    </main>
  );
}
