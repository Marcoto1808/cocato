import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  detectarProductosEnMensaje,
  formatearProductoDetectado,
} from "@/lib/productos-detectados";
import { esPedidoEntregado } from "@/lib/pedido-estados";
import {
  PedidoEstadoBadge,
  PedidoEstadoBotones,
  PedidoEstadoProvider,
} from "./PedidoEstadoActions";
// PedidoProductos se usará en una pantalla independiente de preparación.
// import PedidoProductos from "./PedidoProductos";

export const dynamic = "force-dynamic";

type ClienteJoin = {
  nombre_negocio: string;
  propietario: string | null;
  telefono: string | null;
  whatsapp: string | null;
  direccion: string | null;
};

type PedidoDetalle = {
  id: string;
  cliente_id: string | null;
  estado: string | null;
  fecha: string;
  mensaje_original: string | null;
  observaciones: string | null;
  clientes: ClienteJoin | ClienteJoin[] | null;
};

function resolverCliente(
  clientes: ClienteJoin | ClienteJoin[] | null | undefined
): ClienteJoin | null {
  if (!clientes) return null;
  return Array.isArray(clientes) ? (clientes[0] ?? null) : clientes;
}

function mapsUrl(direccion: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PedidoDetallePage({ params }: Props) {
  const { id } = await params;

  const [{ data: pedido, error }, { data: todosPedidos }, { data: catalogoProductos }] =
    await Promise.all([
    supabase
      .from("pedidos")
      .select(
        "id, cliente_id, estado, fecha, mensaje_original, observaciones, clientes(nombre_negocio, propietario, telefono, whatsapp, direccion)"
      )
      .eq("id", id)
      .single(),
    supabase.from("pedidos").select("id").order("fecha", { ascending: false }),
    supabase.from("productos").select("nombre, unidad").eq("activo", true),
  ]);

  if (error || !pedido) {
    notFound();
  }

  const detalle = pedido as unknown as PedidoDetalle;
  const cliente = resolverCliente(detalle.clientes);
  const numeroPedido =
    (todosPedidos?.findIndex((item) => item.id === id) ?? -1) + 1;
  const nombreNegocio = cliente?.nombre_negocio ?? "Cliente sin asignar";
  const direccion = cliente?.direccion?.trim() || null;
  const telefono = cliente?.telefono?.trim() || null;
  const whatsapp = cliente?.whatsapp?.trim() || null;
  const productosDetectados = detectarProductosEnMensaje(
    detalle.mensaje_original,
    catalogoProductos ?? []
  );
  const pedidoEntregado = esPedidoEntregado(detalle.estado ?? "");

  return (
    <PedidoEstadoProvider pedidoId={id} estadoInicial={detalle.estado}>
      <main className="min-h-screen bg-zinc-100 p-8">
        <Link
          href={
            pedidoEntregado
              ? "/dashboard/pedidos/anteriores"
              : "/dashboard/pedidos"
          }
          className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900"
        >
          {pedidoEntregado
            ? "← Volver a Pedidos anteriores"
            : "← Volver a Pedidos"}
        </Link>

        <div className="mx-auto max-w-2xl space-y-4">
          <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
            <div className="px-6 py-5">
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                {numeroPedido > 0 ? `Pedido ${numeroPedido}` : "Pedido"}
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                {formatFecha(detalle.fecha)}
              </p>
              <div className="mt-3">
                <PedidoEstadoBadge />
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
              Mensaje original
            </h2>
            <div className="rounded-lg bg-zinc-50 px-4 py-4 ring-1 ring-zinc-100">
              <p className="whitespace-pre-wrap text-zinc-800">
                {detalle.mensaje_original ?? "Sin mensaje original."}
              </p>
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
              Productos detectados
            </h2>

            {productosDetectados.length > 0 ? (
              <ul className="divide-y divide-zinc-100 rounded-lg bg-zinc-50 ring-1 ring-zinc-100">
                {productosDetectados.map((producto, index) => (
                  <li
                    key={`${producto.nombre}-${index}`}
                    className="px-4 py-3 text-zinc-800"
                  >
                    {formatearProductoDetectado(producto)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-zinc-50 px-4 py-3 text-zinc-600 ring-1 ring-zinc-100">
                No se detectaron productos en el mensaje original.
              </p>
            )}
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
              Cliente
            </h2>

            {cliente ? (
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-zinc-500">Negocio</dt>
                  <dd className="mt-1 text-xl font-semibold text-zinc-900">
                    {nombreNegocio}
                  </dd>
                </div>

                {cliente.propietario?.trim() ? (
                  <div>
                    <dt className="text-sm font-medium text-zinc-500">
                      Contacto
                    </dt>
                    <dd className="mt-1 text-zinc-800">
                      {cliente.propietario.trim()}
                    </dd>
                  </div>
                ) : null}

                {telefono ? (
                  <div>
                    <dt className="text-sm font-medium text-zinc-500">
                      Teléfono
                    </dt>
                    <dd className="mt-1 text-zinc-800">{telefono}</dd>
                  </div>
                ) : null}

                {whatsapp ? (
                  <div>
                    <dt className="text-sm font-medium text-zinc-500">
                      WhatsApp
                    </dt>
                    <dd className="mt-1 text-zinc-800">{whatsapp}</dd>
                  </div>
                ) : null}

                {!telefono && !whatsapp ? (
                  <div>
                    <dt className="text-sm font-medium text-zinc-500">
                      Teléfono
                    </dt>
                    <dd className="mt-1 text-zinc-800">—</dd>
                  </div>
                ) : null}

                <div>
                  <dt className="text-sm font-medium text-zinc-500">
                    Dirección
                  </dt>
                  <dd className="mt-1 text-zinc-800">
                    {direccion ?? "Dirección no registrada"}
                  </dd>
                  {direccion ? (
                    <dd className="mt-3">
                      <a
                        href={mapsUrl(direccion)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                      >
                        📍 Abrir en Google Maps
                      </a>
                    </dd>
                  ) : null}
                </div>
              </dl>
            ) : (
              <p className="text-xl font-semibold text-zinc-900">
                Cliente sin asignar
              </p>
            )}
          </section>

          {(detalle.observaciones?.trim() ?? "") !== "" && (
            <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
                Observaciones
              </h2>
              <p className="whitespace-pre-wrap text-zinc-700">
                {detalle.observaciones}
              </p>
            </section>
          )}

          <PedidoEstadoBotones />
        </div>
      </main>
    </PedidoEstadoProvider>
  );
}
