import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  detectarOrigenPedido,
  etiquetaOrigenPedido,
} from "@/lib/pedido-origen";
import { esPedidoEntregado } from "@/lib/pedido-estados";
import {
  PedidoEstadoBadge,
  PedidoEstadoBotones,
  PedidoEstadoProvider,
} from "./PedidoEstadoActions";
import PedidoLineasEditor from "./PedidoLineasEditor";
import { lineaPedidoDesdeDetalle } from "@/lib/pedido-lineas";

export const dynamic = "force-dynamic";

type ProductoJoin = {
  nombre: string;
};

type LineaDetalle = {
  id: string;
  producto_id: string;
  cantidad_solicitada: number;
  unidad: string;
  tipo_calculo: string | null;
  peso_real: number | null;
  precio_lista: number;
  precio_aplicado: number;
  precio_modificado: boolean;
  subtotal: number;
  productos: ProductoJoin | ProductoJoin[] | null;
};

type ClienteJoin = {
  nombre_negocio: string;
  propietario: string | null;
  direccion: string | null;
};

type PedidoDetalle = {
  id: string;
  estado: string | null;
  fecha: string;
  mensaje_original: string | null;
  observaciones: string | null;
  total: number | null;
  clientes: ClienteJoin | ClienteJoin[] | null;
  detalle_pedido: LineaDetalle[] | null;
};

function resolverJoin<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function mapsUrl(direccion: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string }>;
};

export default async function PedidoDetallePage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { creado } = await searchParams;

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .select(
      "id, estado, fecha, mensaje_original, observaciones, total, clientes(nombre_negocio, propietario, direccion), detalle_pedido(id, producto_id, cantidad_solicitada, unidad, tipo_calculo, peso_real, precio_lista, precio_aplicado, precio_modificado, subtotal, productos(nombre))"
    )
    .eq("id", id)
    .single();

  if (error || !pedido) {
    notFound();
  }

  const detalle = pedido as unknown as PedidoDetalle;
  const cliente = resolverJoin(detalle.clientes);
  const lineas = (detalle.detalle_pedido ?? []).map((linea) =>
    lineaPedidoDesdeDetalle(linea)
  );
  const nombreNegocio = cliente?.nombre_negocio ?? "Cliente sin asignar";
  const direccion = cliente?.direccion?.trim() || null;
  const pedidoEntregado = esPedidoEntregado(detalle.estado ?? "");
  const origen = detectarOrigenPedido(detalle.mensaje_original);

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

        {creado ? (
          <div className="mx-auto mb-6 max-w-4xl rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
            Pedido guardado correctamente
          </div>
        ) : null}

        <div className="mx-auto max-w-4xl space-y-4">
          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Origen: {etiquetaOrigenPedido(origen)}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
              {nombreNegocio}
            </h1>
            {cliente?.propietario?.trim() ? (
              <p className="mt-1 text-sm text-zinc-500">
                {cliente.propietario.trim()}
              </p>
            ) : null}
            <div className="mt-4">
              <PedidoEstadoBadge />
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-zinc-900">Productos</h2>
              <p className="text-sm text-zinc-500">
                {lineas.length} producto{lineas.length === 1 ? "" : "s"}
              </p>
            </div>

            <PedidoLineasEditor
              pedidoId={id}
              lineasIniciales={lineas}
              soloLectura={pedidoEntregado}
            />
          </section>

          {(direccion || (detalle.observaciones?.trim() ?? "") !== "") && (
            <details className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
              <summary className="cursor-pointer px-6 py-4 text-sm font-medium text-zinc-600">
                Más información
              </summary>
              <div className="space-y-4 border-t border-zinc-100 px-6 py-4 text-sm text-zinc-700">
                {direccion ? (
                  <div>
                    <p className="font-medium text-zinc-500">Dirección</p>
                    <p className="mt-1">{direccion}</p>
                    <a
                      href={mapsUrl(direccion)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900"
                    >
                      Abrir en Maps
                    </a>
                  </div>
                ) : null}
                {detalle.observaciones?.trim() ? (
                  <div>
                    <p className="font-medium text-zinc-500">Observaciones</p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {detalle.observaciones}
                    </p>
                  </div>
                ) : null}
              </div>
            </details>
          )}

          <PedidoEstadoBotones />
        </div>
      </main>
    </PedidoEstadoProvider>
  );
}
