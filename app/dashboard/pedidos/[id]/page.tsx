import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  detectarProductosEnMensaje,
  formatearProductoDetectado,
} from "@/lib/productos-detectados";
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

function telefonoCliente(cliente: ClienteJoin | null) {
  return cliente?.telefono?.trim() || cliente?.whatsapp?.trim() || null;
}

function mapsUrl(direccion: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

type Props = {
  params: Promise<{ id: string }>;
};

export default async function PedidoDetallePage({ params }: Props) {
  const { id } = await params;

  const [{ data: pedido, error }, { data: todosPedidos }] = await Promise.all([
    supabase
      .from("pedidos")
      .select(
        "id, cliente_id, estado, fecha, mensaje_original, observaciones, clientes(nombre_negocio, propietario, telefono, whatsapp, direccion)"
      )
      .eq("id", id)
      .single(),
    supabase.from("pedidos").select("id").order("fecha", { ascending: false }),
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
  const telefono = telefonoCliente(cliente);
  const productosDetectados = detectarProductosEnMensaje(detalle.mensaje_original);

  return (
    <PedidoEstadoProvider pedidoId={id} estadoInicial={detalle.estado}>
      <main className="min-h-screen bg-zinc-100 p-8">
        <Link
          href="/dashboard/pedidos"
          className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Volver a Pedidos
        </Link>

        <div className="mx-auto max-w-2xl space-y-4">
          <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
            <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-5">
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                {numeroPedido > 0 ? `Pedido ${numeroPedido}` : "Pedido"}
              </h1>
              <PedidoEstadoBadge />
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
              Mensaje original
            </h2>
            <p className="whitespace-pre-wrap text-zinc-700">
              {detalle.mensaje_original ?? "Sin mensaje original."}
            </p>
            <p className="mt-3 text-xs text-zinc-400">
              Referencia para preparación. Más adelante la IA podrá convertir
              este mensaje en productos del pedido automáticamente.
            </p>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
              Productos detectados
            </h2>

            {productosDetectados.length > 0 ? (
              <ul className="space-y-2 text-zinc-800">
                {productosDetectados.map((producto, index) => (
                  <li key={`${producto.nombre}-${index}`}>
                    • {formatearProductoDetectado(producto)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-zinc-600">
                No se detectaron productos en el mensaje original.
              </p>
            )}

            <p className="mt-3 text-xs text-zinc-400">
              Desglose automático para verificar que la interpretación del
              pedido coincide con el mensaje del cliente.
            </p>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
              Cliente
            </h2>

            {cliente ? (
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-zinc-500">
                    Nombre del negocio
                  </dt>
                  <dd className="mt-1 text-xl font-semibold text-zinc-900">
                    {nombreNegocio}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-zinc-500">
                    Nombre del contacto
                  </dt>
                  <dd className="mt-1 text-zinc-800">
                    {cliente.propietario?.trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-zinc-500">
                    Teléfono
                  </dt>
                  <dd className="mt-1 text-zinc-800">{telefono || "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-zinc-500">
                    Dirección
                  </dt>
                  <dd className="mt-1 text-zinc-800">
                    {direccion ?? "Dirección no registrada"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-xl font-semibold text-zinc-900">
                Cliente sin asignar
              </p>
            )}

            {cliente && (
              <div className="mt-6 border-t border-zinc-100 pt-6">
                <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
                  Dirección de entrega
                </h3>
                <p className="mt-2 text-zinc-700">
                  {direccion ?? "Dirección no registrada"}
                </p>

                {direccion ? (
                  <a
                    href={mapsUrl(direccion)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
                  >
                    📍 Abrir en Google Maps
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-4 inline-flex cursor-not-allowed items-center rounded-lg bg-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-500"
                  >
                    📍 Abrir en Google Maps
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
              Observaciones
            </h2>
            <p className="whitespace-pre-wrap text-zinc-700">
              {detalle.observaciones || "Sin observaciones."}
            </p>
          </section>

          <PedidoEstadoBotones />
        </div>
      </main>
    </PedidoEstadoProvider>
  );
}
