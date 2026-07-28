import Link from "next/link";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import {
  esClienteActivoReciente,
  esFechaHoy,
  esFechaMesActual,
  formatearFechaPedido,
  formatearHoraPedido,
  formatearMoneda,
  generarSaludo,
} from "@/lib/dashboard-admin";
import {
  esPedidoEntregado,
  esPedidoEnReparto,
  esPedidoOperativo,
  etiquetaEstado,
} from "@/lib/pedido-estados";

export const dynamic = "force-dynamic";

type ClienteJoin = {
  nombre_negocio: string;
};

type PedidoResumen = {
  id: string;
  cliente_id: string | null;
  estado: string;
  fecha: string;
  total: number | null;
  clientes: ClienteJoin | ClienteJoin[] | null;
};

function resolverCliente(
  clientes: ClienteJoin | ClienteJoin[] | null | undefined
): ClienteJoin | null {
  if (!clientes) return null;
  return Array.isArray(clientes) ? (clientes[0] ?? null) : clientes;
}

function nombreCliente(pedido: PedidoResumen) {
  const cliente = resolverCliente(pedido.clientes);
  return cliente?.nombre_negocio ?? "Cliente sin asignar";
}

function sumarVentas(pedidos: PedidoResumen[]) {
  return pedidos.reduce((total, pedido) => total + (pedido.total ?? 0), 0);
}

type TarjetaKpiProps = {
  icono: string;
  valor: string;
  titulo: string;
  descripcion: string;
  borde: string;
  valorClassName?: string;
};

function TarjetaKpi({
  icono,
  valor,
  titulo,
  descripcion,
  borde,
  valorClassName = "text-zinc-900",
}: TarjetaKpiProps) {
  return (
    <article
      className={`rounded-2xl border-l-4 bg-white p-6 shadow-md ring-1 ring-zinc-200/70 ${borde}`}
    >
      <span className="text-5xl leading-none">{icono}</span>
      <p className={`mt-6 text-5xl font-bold tracking-tight ${valorClassName}`}>
        {valor}
      </p>
      <p className="mt-3 text-lg font-semibold text-zinc-900">{titulo}</p>
      <p className="mt-1 text-sm leading-relaxed text-zinc-500">{descripcion}</p>
    </article>
  );
}

type AccesoRapidoProps = {
  href: string;
  titulo: string;
  icono: string;
  descripcion: string;
};

function AccesoRapido({ href, titulo, icono, descripcion }: AccesoRapidoProps) {
  return (
    <Link
      href={href}
      className="group rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-md hover:ring-zinc-300"
    >
      <span className="text-3xl">{icono}</span>
      <p className="mt-4 text-base font-semibold text-zinc-900">{titulo}</p>
      <p className="mt-1 text-sm text-zinc-500">{descripcion}</p>
    </Link>
  );
}

type IndicadorProps = {
  icono: string;
  titulo: string;
  valor: string;
};

function Indicador({ icono, titulo, valor }: IndicadorProps) {
  return (
    <article className="rounded-xl bg-white px-4 py-4 shadow-sm ring-1 ring-zinc-200">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-500">{titulo}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{valor}</p>
        </div>
        <span className="text-2xl">{icono}</span>
      </div>
    </article>
  );
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const nombreUsuario = cookieStore.get("cocato_usuario")?.value ?? null;
  const saludo = generarSaludo(nombreUsuario);

  const [
    { data: pedidos },
    { count: totalClientes },
    { count: productosActivos },
    { count: productosInactivos },
  ] = await Promise.all([
    supabase
      .from("pedidos")
      .select("id, cliente_id, estado, fecha, total, clientes(nombre_negocio)")
      .order("fecha", { ascending: false }),
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    supabase
      .from("productos")
      .select("*", { count: "exact", head: true })
      .eq("activo", true),
    supabase
      .from("productos")
      .select("*", { count: "exact", head: true })
      .eq("activo", false),
  ]);

  const lista = (pedidos ?? []) as PedidoResumen[];

  const pedidosOperativos = lista.filter((pedido) =>
    esPedidoOperativo(pedido.estado)
  );
  const pedidosEnReparto = lista.filter((pedido) =>
    esPedidoEnReparto(pedido.estado)
  );
  const pedidosHoy = lista.filter((pedido) => esFechaHoy(pedido.fecha));
  const pedidosEntregadosHoy = pedidosHoy.filter((pedido) =>
    esPedidoEntregado(pedido.estado)
  );
  const pedidosEntregadosMes = lista.filter(
    (pedido) =>
      esPedidoEntregado(pedido.estado) && esFechaMesActual(pedido.fecha)
  );

  const ventasDelDia = sumarVentas(pedidosEntregadosHoy);
  const ventasDelMes = sumarVentas(pedidosEntregadosMes);

  const clientesActivos = new Set(
    lista
      .filter(
        (pedido) =>
          pedido.cliente_id && esClienteActivoReciente(pedido.fecha, 30)
      )
      .map((pedido) => pedido.cliente_id)
  ).size;

  const ultimosPedidos = lista.slice(0, 5);

  return (
    <main className="min-h-screen bg-zinc-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <header className="border-b border-zinc-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            COCATO · Administración
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
            {saludo}
          </h1>
          <p className="mt-2 max-w-2xl text-zinc-600">
            Estado operativo del negocio en un vistazo.
          </p>
        </header>

        <section aria-labelledby="resumen-operativo">
          <h2 id="resumen-operativo" className="sr-only">
            Resumen operativo
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaKpi
              icono="📦"
              valor={String(pedidosOperativos.length)}
              titulo="Pedidos activos"
              descripcion="Pendiente, preparando y listo"
              borde="border-l-amber-500"
              valorClassName="text-amber-600"
            />
            <TarjetaKpi
              icono="🚚"
              valor={String(pedidosEnReparto.length)}
              titulo="Pedidos en reparto"
              descripcion="Actualmente en ruta de entrega"
              borde="border-l-blue-500"
              valorClassName="text-blue-600"
            />
            <TarjetaKpi
              icono="💰"
              valor={formatearMoneda(ventasDelDia)}
              titulo="Ventas del día"
              descripcion="Total de pedidos entregados hoy"
              borde="border-l-emerald-500"
              valorClassName="text-emerald-600"
            />
            <TarjetaKpi
              icono="📈"
              valor={formatearMoneda(ventasDelMes)}
              titulo="Ventas del mes"
              descripcion="Total de pedidos entregados este mes"
              borde="border-l-violet-500"
              valorClassName="text-violet-600"
            />
          </div>
        </section>

        <section aria-labelledby="accesos-rapidos">
          <div className="mb-4">
            <h2
              id="accesos-rapidos"
              className="text-lg font-semibold text-zinc-900"
            >
              Accesos rápidos
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Entra directamente a cada módulo del sistema.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <AccesoRapido
              href="/clientes"
              titulo="Clientes"
              icono="👥"
              descripcion="Directorio y altas"
            />
            <AccesoRapido
              href="/productos"
              titulo="Productos"
              icono="🥩"
              descripcion="Catálogo y precios"
            />
            <AccesoRapido
              href="/dashboard/pedidos"
              titulo="Pedidos"
              icono="📦"
              descripcion="Bandeja operativa"
            />
            <AccesoRapido
              href="/usuarios"
              titulo="Usuarios"
              icono="👤"
              descripcion="Accesos del equipo"
            />
            <AccesoRapido
              href="#resumen-negocio"
              titulo="Reportes"
              icono="📊"
              descripcion="Indicadores generales"
            />
            <AccesoRapido
              href="#configuracion"
              titulo="Configuración"
              icono="⚙️"
              descripcion="Ajustes del sistema"
            />
          </div>
        </section>

        <section aria-labelledby="actividad-reciente">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="actividad-reciente"
                className="text-lg font-semibold text-zinc-900"
              >
                Actividad reciente
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Últimos cinco pedidos registrados.
              </p>
            </div>
            <Link
              href="/dashboard/pedidos"
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Ver todos los pedidos
            </Link>
          </div>

          {ultimosPedidos.length > 0 ? (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
              <div className="divide-y divide-zinc-100">
                {ultimosPedidos.map((pedido, index) => (
                  <Link
                    key={pedido.id}
                    href={`/dashboard/pedidos/${pedido.id}`}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-zinc-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-500">
                        Pedido {index + 1}
                      </p>
                      <p className="mt-1 truncate text-lg font-semibold text-zinc-900">
                        {nombreCliente(pedido)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="rounded-full bg-zinc-100 px-3 py-1 font-medium text-zinc-700 ring-1 ring-zinc-200">
                        {etiquetaEstado(pedido.estado)}
                      </span>
                      <span className="text-zinc-600">
                        {formatearFechaPedido(pedido.fecha)}
                      </span>
                      <span className="font-medium text-zinc-800">
                        {formatearHoraPedido(pedido.fecha)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-8 text-center text-zinc-600 shadow-sm ring-1 ring-zinc-200">
              No hay pedidos registrados todavía.
            </div>
          )}
        </section>

        <section id="resumen-negocio" aria-labelledby="titulo-resumen-negocio">
          <div className="mb-4">
            <h2
              id="titulo-resumen-negocio"
              className="text-lg font-semibold text-zinc-900"
            >
              Resumen del negocio
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Indicadores generales del catálogo, clientes y operación diaria.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Indicador
              icono="👥"
              titulo="Clientes registrados"
              valor={String(totalClientes ?? 0)}
            />
            <Indicador
              icono="🥩"
              titulo="Productos activos"
              valor={String(productosActivos ?? 0)}
            />
            <Indicador
              icono="🚫"
              titulo="Productos inactivos"
              valor={String(productosInactivos ?? 0)}
            />
            <Indicador
              icono="📦"
              titulo="Pedidos entregados hoy"
              valor={String(pedidosEntregadosHoy.length)}
            />
            <Indicador
              icono="📅"
              titulo="Pedidos realizados hoy"
              valor={String(pedidosHoy.length)}
            />
            <Indicador
              icono="🟢"
              titulo="Clientes activos"
              valor={String(clientesActivos)}
            />
          </div>
          <p className="mt-3 text-xs text-zinc-400">
            Clientes activos: con al menos un pedido en los últimos 30 días.
          </p>
        </section>

        <section
          id="configuracion"
          className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 shadow-sm"
        >
          <h2 className="text-base font-semibold text-zinc-900">Configuración</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Módulo de configuración disponible próximamente.
          </p>
        </section>
      </div>
    </main>
  );
}
