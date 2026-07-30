import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { obtenerRutaDashboardServidor } from "@/lib/navegacion-dashboard-server";
import { esMismoDiaCalendario } from "@/lib/pedido-fecha";
import {
  esPedidoEntregado,
  esPedidoOperativo,
  normalizarEstado,
  type EstadoCategoria,
} from "@/lib/pedido-estados";
import PedidosTarjetasEstado, {
  type FiltroTarjetaEstado,
  type PedidoResumenTarjeta,
} from "@/components/pedidos/PedidosTarjetasEstado";
import { nombreMostrarPedido } from "@/lib/pedido-rapido";

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
  updated_at: string;
  total: number | null;
  cliente_nombre_temporal: string | null;
  clientes: ClienteJoin | ClienteJoin[] | null;
  detalle_pedido: { count: number }[] | { count: number } | null;
};

function resolverCliente(
  clientes: ClienteJoin | ClienteJoin[] | null | undefined
): ClienteJoin | null {
  if (!clientes) return null;
  return Array.isArray(clientes) ? (clientes[0] ?? null) : clientes;
}

type EstadoCategoriaTablero = EstadoCategoria;

function contarPorEstado(pedidos: Pedido[]) {
  return pedidos.reduce(
    (acc, pedido) => {
      const categoria = normalizarEstado(pedido.estado);

      if (categoria === "pendiente") acc.pendiente += 1;
      if (categoria === "listo") acc.listo += 1;
      if (
        categoria === "entregado" &&
        esMismoDiaCalendario(pedido.updated_at)
      ) {
        acc.entregado += 1;
      }

      return acc;
    },
    {
      pendiente: 0,
      listo: 0,
      entregado: 0,
    }
  );
}

function nombreCliente(pedido: Pedido) {
  return nombreMostrarPedido(pedido);
}

function contarLineas(detalle: Pedido["detalle_pedido"]): number {
  if (!detalle) return 0;
  if (Array.isArray(detalle)) {
    return detalle[0]?.count ?? 0;
  }
  return detalle.count ?? 0;
}

function pedidoAResumen(pedido: Pedido): PedidoResumenTarjeta {
  return {
    id: pedido.id,
    nombreCliente: nombreCliente(pedido),
    total: pedido.total,
    lineas: contarLineas(pedido.detalle_pedido),
    fecha: pedido.fecha,
  };
}

function agruparPedidosPorEstado(pedidos: Pedido[]) {
  const grupos: Record<EstadoCategoriaTablero, PedidoResumenTarjeta[]> = {
    pendiente: [],
    listo: [],
    entregado: [],
  };

  for (const pedido of pedidos) {
    const categoria = normalizarEstado(pedido.estado);

    if (categoria === "pendiente" || categoria === "listo") {
      grupos[categoria].push(pedidoAResumen(pedido));
      continue;
    }

    if (
      categoria === "entregado" &&
      esMismoDiaCalendario(pedido.updated_at)
    ) {
      grupos.entregado.push(pedidoAResumen(pedido));
    }
  }

  return grupos;
}

const FILTROS: {
  clave: EstadoCategoriaTablero;
  etiqueta: string;
  contador: keyof ReturnType<typeof contarPorEstado>;
  color: string;
  anillo: string;
}[] = [
  {
    clave: "pendiente",
    etiqueta: "🟡 Pendientes",
    contador: "pendiente",
    color: "text-amber-600",
    anillo: "ring-amber-500",
  },
  {
    clave: "listo",
    etiqueta: "🟢 Listos",
    contador: "listo",
    color: "text-emerald-600",
    anillo: "ring-emerald-500",
  },
  {
    clave: "entregado",
    etiqueta: "✅ Entregados",
    contador: "entregado",
    color: "text-zinc-600",
    anillo: "ring-zinc-400",
  },
];

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ actualizado?: string; creado?: string }>;
}) {
  const { actualizado, creado } = await searchParams;
  const rutaDashboard = await obtenerRutaDashboardServidor();

  const { data: pedidos, error } = await supabase
    .from("pedidos")
    .select(
      "id, cliente_id, estado, fecha, updated_at, total, cliente_nombre_temporal, clientes(nombre_negocio), detalle_pedido(count)"
    )
    .order("fecha", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-100 p-8">
        <Link
          href={rutaDashboard}
          className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900"
        >
          ← Volver al Dashboard
        </Link>
        <h1 className="mb-6 text-3xl font-bold">Pedidos</h1>
        <div className="rounded-xl bg-white p-6 shadow">
          <p className="text-red-600">Error al cargar los pedidos.</p>
        </div>
      </main>
    );
  }

  const lista = (pedidos ?? []) as Pedido[];
  const listaTablero = lista.filter(
    (pedido) =>
      esPedidoOperativo(pedido.estado) ||
      (esPedidoEntregado(pedido.estado) &&
        esMismoDiaCalendario(pedido.updated_at))
  );
  const contadores = contarPorEstado(lista);
  const pedidosPorEstado = agruparPedidosPorEstado(lista);
  const tarjetas: FiltroTarjetaEstado[] = FILTROS.map((filtro) => ({
    clave: filtro.clave,
    etiqueta: filtro.etiqueta,
    contador: contadores[filtro.contador],
    color: filtro.color,
    anillo: filtro.anillo,
  }));

  return (
    <main className="min-h-screen bg-zinc-100 p-8">
      <Link
        href={rutaDashboard}
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Volver al Dashboard
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pedidos</h1>
          <p className="mt-1 text-zinc-500">Bandeja de trabajo</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/pedidos/anteriores"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Pedidos anteriores
          </Link>
          <Link
            href="/dashboard/pedidos/nuevo"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            + Nuevo pedido
          </Link>
        </div>
      </div>

      {creado ? (
        <div className="mb-6 rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          Pedido creado correctamente
        </div>
      ) : null}

      {actualizado ? (
        <div className="mb-6 rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          Pedido actualizado a {decodeURIComponent(actualizado)}
        </div>
      ) : null}

      <PedidosTarjetasEstado
        filtros={tarjetas}
        pedidosPorEstado={pedidosPorEstado}
      />

      {listaTablero.length === 0 ? (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          No hay pedidos en el tablero.
        </div>
      ) : null}
    </main>
  );
}
