import Link from "next/link";
import { supabase } from "@/lib/supabase";

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

type EstadoCategoria =
  | "pendiente"
  | "preparando"
  | "listo"
  | "reparto"
  | "entregado";

function normalizarEstado(estado: string): EstadoCategoria | null {
  const valor = estado.toLowerCase().trim();

  if (valor.includes("pendiente")) return "pendiente";
  if (valor.includes("listo")) return "listo";
  if (valor.includes("preparando")) return "preparando";
  if (valor.includes("reparto")) return "reparto";
  if (valor.includes("entregado")) return "entregado";

  return null;
}

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function contarPorEstado(pedidos: Pedido[]) {
  return pedidos.reduce(
    (acc, pedido) => {
      const categoria = normalizarEstado(pedido.estado);

      if (categoria) {
        acc[categoria] += 1;
      }

      return acc;
    },
    {
      pendiente: 0,
      preparando: 0,
      listo: 0,
      reparto: 0,
      entregado: 0,
    }
  );
}

function nombreCliente(pedido: Pedido) {
  const cliente = resolverCliente(pedido.clientes);
  return cliente?.nombre_negocio ?? "Cliente sin asignar";
}

const FILTROS: {
  clave: EstadoCategoria;
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
    clave: "preparando",
    etiqueta: "🟡 Preparando",
    contador: "preparando",
    color: "text-amber-600",
    anillo: "ring-amber-500",
  },
  {
    clave: "listo",
    etiqueta: "🟢 Listo",
    contador: "listo",
    color: "text-emerald-600",
    anillo: "ring-emerald-500",
  },
  {
    clave: "reparto",
    etiqueta: "🚚 Reparto",
    contador: "reparto",
    color: "text-blue-600",
    anillo: "ring-blue-500",
  },
  {
    clave: "entregado",
    etiqueta: "✅ Entregados",
    contador: "entregado",
    color: "text-emerald-600",
    anillo: "ring-emerald-500",
  },
];

function esEstadoCategoria(valor: string | undefined): valor is EstadoCategoria {
  return FILTROS.some((filtro) => filtro.clave === valor);
}

function urlPedidos(params: {
  estado?: EstadoCategoria;
  actualizado?: string;
  creado?: string;
}) {
  const search = new URLSearchParams();

  if (params.estado) {
    search.set("estado", params.estado);
  }

  if (params.actualizado) {
    search.set("actualizado", params.actualizado);
  }

  if (params.creado) {
    search.set("creado", params.creado);
  }

  const query = search.toString();
  return query ? `/dashboard/pedidos?${query}` : "/dashboard/pedidos";
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ actualizado?: string; estado?: string; creado?: string }>;
}) {
  const { actualizado, estado: estadoParam, creado } = await searchParams;
  const filtroActivo = esEstadoCategoria(estadoParam) ? estadoParam : null;

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
          href="/dashboard"
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
  const contadores = contarPorEstado(lista);
  const listaFiltrada = filtroActivo
    ? lista.filter(
        (pedido) => normalizarEstado(pedido.estado) === filtroActivo
      )
    : lista;

  return (
    <main className="min-h-screen bg-zinc-100 p-8">
      <Link
        href="/dashboard"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Volver al Dashboard
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Pedidos</h1>
          <p className="mt-1 text-zinc-500">Bandeja de trabajo</p>
        </div>

        <Link
          href="/dashboard/pedidos/nuevo"
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          + Nuevo pedido
        </Link>
      </div>

      {creado && (
        <div className="mb-6 rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          Pedido creado correctamente
        </div>
      )}

      {actualizado && (
        <div className="mb-6 rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          Pedido actualizado a {decodeURIComponent(actualizado)}
        </div>
      )}

      <div className="mb-4">
        <Link
          href={urlPedidos({ actualizado })}
          className={`inline-flex rounded-full px-4 py-2 text-sm font-medium transition ${
            filtroActivo
              ? "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
              : "bg-black text-white"
          }`}
        >
          Todos
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {FILTROS.map((filtro) => {
          const activo = filtroActivo === filtro.clave;

          return (
            <Link
              key={filtro.clave}
              href={urlPedidos({
                estado: filtro.clave,
                actualizado,
              })}
              className={`rounded-xl bg-white p-5 shadow-sm transition hover:shadow-md ${
                activo
                  ? `ring-2 ${filtro.anillo}`
                  : "ring-1 ring-zinc-200 hover:ring-zinc-300"
              }`}
            >
              <p className="text-sm text-zinc-500">{filtro.etiqueta}</p>
              <p className={`mt-2 text-3xl font-bold ${filtro.color}`}>
                {contadores[filtro.contador]}
              </p>
            </Link>
          );
        })}
      </div>

      {listaFiltrada.length > 0 ? (
        <div className="mx-auto max-w-2xl space-y-3">
          {listaFiltrada.map((pedido, index) => {
            const cliente = resolverCliente(pedido.clientes);
            const telefono = telefonoCliente(cliente);

            return (
            <Link
              key={pedido.id}
              href={`/dashboard/pedidos/${pedido.id}`}
              className="block overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 transition hover:bg-zinc-50 hover:shadow-md hover:ring-zinc-300"
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
                    <dd className="inline text-zinc-800">{pedido.estado}</dd>
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

                <p className="mt-4 text-sm font-medium text-zinc-500">
                  0 productos
                </p>
              </div>
            </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          {filtroActivo
            ? "No hay pedidos en este estado."
            : "No hay pedidos registrados."}
        </div>
      )}
    </main>
  );
}
