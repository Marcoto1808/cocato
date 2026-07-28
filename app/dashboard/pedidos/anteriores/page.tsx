import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { esPedidoEntregado, etiquetaEstado } from "@/lib/pedido-estados";
import EliminarPedidoButton from "./EliminarPedidoButton";

export const dynamic = "force-dynamic";

type ClienteJoin = {
  nombre_negocio: string;
  propietario: string | null;
  telefono: string | null;
  whatsapp: string | null;
  direccion: string | null;
};

type Pedido = {
  id: string;
  cliente_id: string | null;
  estado: string;
  fecha: string;
  clientes: ClienteJoin | ClienteJoin[] | null;
};

function resolverCliente(
  clientes: ClienteJoin | ClienteJoin[] | null | undefined
): ClienteJoin | null {
  if (!clientes) return null;
  return Array.isArray(clientes) ? (clientes[0] ?? null) : clientes;
}

function telefonoCliente(cliente: ClienteJoin | null) {
  return cliente?.telefono?.trim() || cliente?.whatsapp?.trim() || null;
}

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function nombreCliente(pedido: Pedido) {
  const cliente = resolverCliente(pedido.clientes);
  return cliente?.nombre_negocio ?? "Cliente sin asignar";
}

export default async function PedidosAnterioresPage({
  searchParams,
}: {
  searchParams: Promise<{ eliminado?: string; actualizado?: string }>;
}) {
  const { eliminado, actualizado } = await searchParams;

  const { data: pedidos, error } = await supabase
    .from("pedidos")
    .select(
      "id, cliente_id, estado, fecha, clientes(nombre_negocio, propietario, telefono, whatsapp, direccion)"
    )
    .order("fecha", { ascending: false });

  if (error) {
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
          {lista.map((pedido, index) => {
            const cliente = resolverCliente(pedido.clientes);
            const telefono = telefonoCliente(cliente);

            return (
              <article
                key={pedido.id}
                className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200"
              >
                <Link
                  href={`/dashboard/pedidos/${pedido.id}`}
                  className="block transition hover:bg-zinc-50"
                >
                  <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-5">
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
                      Pedido {index + 1}
                    </h2>
                  </div>

                  <div className="px-6 py-5">
                    <p className="text-xl font-semibold text-zinc-900">
                      {nombreCliente(pedido)}
                    </p>

                    {cliente ? (
                      <dl className="mt-3 space-y-1 text-sm text-zinc-600">
                        <div>
                          <dt className="inline font-medium text-zinc-500">
                            Contacto:{" "}
                          </dt>
                          <dd className="inline text-zinc-800">
                            {cliente.propietario?.trim() || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline font-medium text-zinc-500">
                            Teléfono:{" "}
                          </dt>
                          <dd className="inline text-zinc-800">
                            {telefono || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline font-medium text-zinc-500">
                            Dirección:{" "}
                          </dt>
                          <dd className="inline text-zinc-800">
                            {cliente.direccion?.trim() || "—"}
                          </dd>
                        </div>
                      </dl>
                    ) : null}

                    <dl className="mt-4 space-y-2 text-sm text-zinc-600">
                      <div>
                        <dt className="inline font-medium text-zinc-500">
                          Estado:{" "}
                        </dt>
                        <dd className="inline text-zinc-800">
                          {etiquetaEstado(pedido.estado)}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium text-zinc-500">
                          Fecha:{" "}
                        </dt>
                        <dd className="inline text-zinc-800">
                          {formatFecha(pedido.fecha)}
                        </dd>
                      </div>
                    </dl>
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
