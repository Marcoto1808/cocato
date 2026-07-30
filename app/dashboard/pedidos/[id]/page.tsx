import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { obtenerSesion } from "@/lib/auth-server";
import {
  detectarOrigenPedido,
  etiquetaOrigenPedido,
} from "@/lib/pedido-origen";
import { esPedidoEntregado, etiquetaEstado } from "@/lib/pedido-estados";
import {
  esPedidoRapido,
  ETIQUETA_CLIENTE_TEMPORAL,
  nombreMostrarPedido,
} from "@/lib/pedido-rapido";
import { PedidoEstadoProvider } from "./PedidoEstadoActions";
import PedidoLineasEditor from "./PedidoLineasEditor";
import RegistrarClienteDesdePedidoLink from "@/components/pedidos/RegistrarClienteDesdePedidoLink";
import { lineaPedidoDesdeDetalle } from "@/lib/pedido-lineas";

export const dynamic = "force-dynamic";

type ProductoJoin = {
  nombre: string;
};

type LineaDetalle = {
  id: string;
  producto_id: string;
  cantidad_solicitada: number;
  cantidad_texto: string | null;
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
  cliente_nombre_temporal: string | null;
  cliente_telefono_temporal: string | null;
  clientes: ClienteJoin | ClienteJoin[] | null;
  detalle_pedido: LineaDetalle[] | null;
};

function resolverJoin<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function formatearFechaPedido(fecha: string) {
  const parsed = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return fecha;

  return parsed.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
  const sesion = await obtenerSesion();
  const esAdmin = sesion?.rol === "administrador";

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .select(
      "id, estado, fecha, mensaje_original, observaciones, total, cliente_nombre_temporal, cliente_telefono_temporal, clientes(nombre_negocio, propietario, direccion), detalle_pedido(id, producto_id, cantidad_solicitada, cantidad_texto, unidad, tipo_calculo, peso_real, precio_lista, precio_aplicado, precio_modificado, subtotal, productos(nombre))"
    )
    .eq("id", id)
    .single();

  if (error || !pedido) {
    notFound();
  }

  const detalle = pedido as unknown as PedidoDetalle;
  const lineas = (detalle.detalle_pedido ?? []).map((linea) =>
    lineaPedidoDesdeDetalle(linea)
  );
  const nombreNegocio = nombreMostrarPedido(detalle);
  const pedidoRapido = esPedidoRapido(detalle);
  const pedidoEntregado = esPedidoEntregado(detalle.estado ?? "");
  const origen = detectarOrigenPedido(detalle.mensaje_original);

  return (
    <PedidoEstadoProvider pedidoId={id} estadoInicial={detalle.estado}>
      <main className="min-h-screen bg-zinc-100 px-4 py-6 sm:px-6">
        <Link
          href={
            pedidoEntregado
              ? "/dashboard/pedidos/anteriores"
              : "/dashboard/pedidos"
          }
          className="mb-4 inline-block text-sm text-zinc-500 hover:text-zinc-900"
        >
          {pedidoEntregado
            ? "← Volver a Pedidos anteriores"
            : "← Volver a Pedidos"}
        </Link>

        {creado ? (
          <div className="mx-auto mb-4 max-w-lg rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
            Pedido guardado correctamente
          </div>
        ) : null}

        <div className="mx-auto max-w-lg space-y-4">
          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Cliente
                </dt>
                <dd className="mt-0.5 font-semibold text-zinc-900">
                  {nombreNegocio}
                </dd>
                {pedidoRapido ? (
                  <dd className="mt-2">
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      {ETIQUETA_CLIENTE_TEMPORAL}
                    </span>
                  </dd>
                ) : null}
                {pedidoRapido && detalle.cliente_telefono_temporal?.trim() ? (
                  <dd className="mt-1 text-sm text-zinc-600">
                    {detalle.cliente_telefono_temporal.trim()}
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Estado
                </dt>
                <dd className="mt-0.5 font-medium text-zinc-900">
                  {etiquetaEstado(detalle.estado)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Fecha
                </dt>
                <dd className="mt-0.5 text-zinc-700">
                  {formatearFechaPedido(detalle.fecha)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Origen
                </dt>
                <dd className="mt-0.5 text-zinc-700">
                  {etiquetaOrigenPedido(origen)}
                </dd>
              </div>
            </dl>
          </section>

          {esAdmin && pedidoRapido ? (
            <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
              <p className="mb-3 text-sm text-zinc-600">
                Este pedido usa un cliente temporal. Regístralo para vincular el
                historial y futuros pedidos.
              </p>
              <RegistrarClienteDesdePedidoLink pedidoId={id} />
            </section>
          ) : null}

          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Orden de preparación
            </h2>

            <PedidoLineasEditor
              pedidoId={id}
              lineasIniciales={lineas}
              soloLectura={pedidoEntregado}
            />
          </section>
        </div>
      </main>
    </PedidoEstadoProvider>
  );
}
