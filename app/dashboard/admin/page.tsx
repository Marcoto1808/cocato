import Link from "next/link";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { obtenerSesion } from "@/lib/auth-server";
import AdminBarraSuperior from "./AdminBarraSuperior";
import CerrarSesionButton from "@/components/navegacion/CerrarSesionButton";
import {
  esClienteActivoReciente,
  esFechaHoy,
  esFechaMesActual,
  esPedidoPendienteAntiguo,
  formatearFechaActual,
  formatearFechaPedido,
  formatearHoraActual,
  formatearHoraPedido,
  formatearMoneda,
  formatearUltimaActualizacion,
  generarSaludo,
} from "@/lib/dashboard-admin";
import {
  esPedidoEntregado,
  esPedidoEnReparto,
  esPedidoOperativo,
  etiquetaEstado,
  normalizarEstado,
} from "@/lib/pedido-estados";

export const dynamic = "force-dynamic";

type ClienteJoin = {
  nombre_negocio: string;
};

type ProductoResumen = {
  id: string;
  nombre: string;
  precio_kg: number | null;
  activo: boolean;
};

type PedidoResumen = {
  id: string;
  cliente_id: string | null;
  estado: string;
  fecha: string;
  total: number | null;
  clientes: ClienteJoin | ClienteJoin[] | null;
};

type Actividad = {
  id: string;
  texto: string;
  detalle: string;
  fecha: string;
};

type Alerta = {
  id: string;
  icono: string;
  titulo: string;
  descripcion: string;
  href?: string;
  tono: "amber" | "red" | "zinc";
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

function contarPorEstadoOperativo(pedidos: PedidoResumen[]) {
  return pedidos.reduce(
    (acc, pedido) => {
      const categoria = normalizarEstado(pedido.estado);
      if (categoria === "pendiente") acc.pendiente += 1;
      if (categoria === "listo") acc.listo += 1;
      return acc;
    },
    { pendiente: 0, listo: 0 }
  );
}

type TarjetaKpiProps = {
  href: string;
  icono: string;
  valor: string;
  titulo: string;
  descripcion: string;
  borde: string;
  valorClassName?: string;
  resumen: ReactNode;
};

function TarjetaKpi({
  href,
  icono,
  valor,
  titulo,
  descripcion,
  borde,
  valorClassName = "text-zinc-900",
  resumen,
}: TarjetaKpiProps) {
  return (
    <Link
      href={href}
      className={`block rounded-2xl border-l-4 bg-white p-6 shadow-md ring-1 ring-zinc-200/70 transition hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-lg ${borde}`}
    >
      <span className="text-5xl leading-none">{icono}</span>
      <p className="mt-4 text-lg font-semibold text-zinc-900">{titulo}</p>
      <p className={`mt-2 text-5xl font-bold tracking-tight ${valorClassName}`}>
        {valor}
      </p>
      <div className="mt-3 space-y-0.5 text-sm text-zinc-600">{resumen}</div>
      <p className="mt-4 text-sm leading-relaxed text-zinc-500">{descripcion}</p>
    </Link>
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

function estiloAlerta(tono: Alerta["tono"]) {
  switch (tono) {
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "red":
      return "border-red-200 bg-red-50 text-red-900";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-800";
  }
}

function construirActividades(pedidos: PedidoResumen[]): Actividad[] {
  return pedidos.slice(0, 8).map((pedido) => ({
    id: `pedido-${pedido.id}`,
    texto: `Pedido de ${nombreCliente(pedido)}`,
    detalle: etiquetaEstado(pedido.estado),
    fecha: pedido.fecha,
  }));
}

export default async function AdminDashboardPage() {
  const ahora = new Date();
  const sesion = await obtenerSesion();
  const saludo = generarSaludo(sesion?.nombre ?? sesion?.usuario ?? null);

  const [
    { data: pedidos },
    { count: totalClientes },
    { count: productosActivos },
    { count: productosInactivos },
    { data: productos },
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
    supabase
      .from("productos")
      .select("id, nombre, precio_kg, activo")
      .order("nombre", { ascending: true }),
  ]);

  const lista = (pedidos ?? []) as PedidoResumen[];
  const catalogo = (productos ?? []) as ProductoResumen[];

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
  const desgloseOperativo = contarPorEstadoOperativo(pedidosOperativos);

  const clientesActivos = new Set(
    lista
      .filter(
        (pedido) =>
          pedido.cliente_id && esClienteActivoReciente(pedido.fecha, 30)
      )
      .map((pedido) => pedido.cliente_id)
  ).size;

  const pedidosPendientesAntiguos = lista.filter((pedido) =>
    esPedidoPendienteAntiguo(pedido.fecha, pedido.estado)
  );
  const productosPrecioCero = catalogo.filter(
    (producto) => (producto.precio_kg ?? 0) <= 0
  );
  const productosInactivosLista = catalogo.filter((producto) => !producto.activo);

  const alertas: Alerta[] = [];

  if (pedidosPendientesAntiguos.length > 0) {
    alertas.push({
      id: "pendientes-antiguos",
      icono: "⏳",
      titulo: `${pedidosPendientesAntiguos.length} pedido(s) pendiente(s) por mucho tiempo`,
      descripcion: pedidosPendientesAntiguos
        .slice(0, 3)
        .map((pedido) => nombreCliente(pedido))
        .join(", "),
      href: "/dashboard/pedidos?estado=pendiente",
      tono: "amber",
    });
  }

  if (productosPrecioCero.length > 0) {
    alertas.push({
      id: "precio-cero",
      icono: "💲",
      titulo: `${productosPrecioCero.length} producto(s) con precio en $0`,
      descripcion: productosPrecioCero
        .slice(0, 3)
        .map((producto) => producto.nombre)
        .join(", "),
      href: "/productos",
      tono: "red",
    });
  }

  if (productosInactivosLista.length > 0) {
    alertas.push({
      id: "productos-inactivos",
      icono: "🚫",
      titulo: `${productosInactivosLista.length} producto(s) inactivo(s)`,
      descripcion: productosInactivosLista
        .slice(0, 3)
        .map((producto) => producto.nombre)
        .join(", "),
      href: "/productos",
      tono: "zinc",
    });
  }

  const actividades = construirActividades(lista);

  return (
    <main className="min-h-screen bg-zinc-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <AdminBarraSuperior
              saludo={saludo}
              fechaInicial={formatearFechaActual(ahora)}
              horaInicial={formatearHoraActual(ahora)}
              ultimaActualizacion={formatearUltimaActualizacion(ahora)}
            />
          </div>
          <CerrarSesionButton className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50" />
        </div>

        <section aria-labelledby="acciones-rapidas">
          <h2 id="acciones-rapidas" className="sr-only">
            Acciones rápidas
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/pedidos/nuevo"
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              + Nuevo pedido
            </Link>
            <Link
              href="/clientes"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
            >
              + Nuevo cliente
            </Link>
            <Link
              href="/productos"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
            >
              + Nuevo producto
            </Link>
            <Link
              href="/balance"
              className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 transition hover:bg-emerald-100"
            >
              Balance
            </Link>
          </div>
        </section>

        <section aria-labelledby="resumen-operativo">
          <h2 id="resumen-operativo" className="sr-only">
            Resumen operativo
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <TarjetaKpi
              href="/dashboard/pedidos"
              icono="📦"
              valor={String(pedidosOperativos.length)}
              titulo="Pedidos activos"
              descripcion="Pendientes y listos"
              borde="border-l-amber-500"
              valorClassName="text-amber-600"
              resumen={
                <>
                  <p>{desgloseOperativo.pendiente} pendientes</p>
                  <p>{desgloseOperativo.listo} listos</p>
                </>
              }
            />
            <TarjetaKpi
              href="/dashboard/pedidos?estado=reparto"
              icono="🚚"
              valor={String(pedidosEnReparto.length)}
              titulo="Pedidos en reparto"
              descripcion="Actualmente en ruta de entrega"
              borde="border-l-blue-500"
              valorClassName="text-blue-600"
              resumen={
                pedidosEnReparto.length > 0 ? (
                  <p>{pedidosEnReparto.length} en ruta de entrega</p>
                ) : (
                  <p>Sin pedidos en ruta</p>
                )
              }
            />
            <TarjetaKpi
              href="#resumen-negocio"
              icono="💰"
              valor={formatearMoneda(ventasDelDia)}
              titulo="Ventas del día"
              descripcion="Total de pedidos entregados hoy"
              borde="border-l-emerald-500"
              valorClassName="text-emerald-600"
              resumen={
                <>
                  <p>{pedidosEntregadosHoy.length} entregados hoy</p>
                  <p>
                    {pedidosHoy.length} pedido(s) registrados hoy
                  </p>
                </>
              }
            />
            <TarjetaKpi
              href="#resumen-negocio"
              icono="📈"
              valor={formatearMoneda(ventasDelMes)}
              titulo="Ventas del mes"
              descripcion="Total de pedidos entregados este mes"
              borde="border-l-violet-500"
              valorClassName="text-violet-600"
              resumen={
                <>
                  <p>{pedidosEntregadosMes.length} entregados este mes</p>
                  <p>
                    Promedio:{" "}
                    {formatearMoneda(
                      pedidosEntregadosMes.length > 0
                        ? ventasDelMes / pedidosEntregadosMes.length
                        : 0
                    )}
                  </p>
                </>
              }
            />
          </div>
        </section>

        <section aria-labelledby="alertas">
          <div className="mb-4">
            <h2 id="alertas" className="text-lg font-semibold text-zinc-900">
              Alertas
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Situaciones que requieren atención.
            </p>
          </div>

          {alertas.length > 0 ? (
            <div className="grid gap-3">
              {alertas.map((alerta) => {
                const contenido = (
                  <article
                    className={`rounded-xl border px-4 py-4 ${estiloAlerta(alerta.tono)}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{alerta.icono}</span>
                      <div>
                        <p className="font-semibold">{alerta.titulo}</p>
                        <p className="mt-1 text-sm opacity-90">
                          {alerta.descripcion}
                        </p>
                      </div>
                    </div>
                  </article>
                );

                return alerta.href ? (
                  <Link key={alerta.id} href={alerta.href} className="block">
                    {contenido}
                  </Link>
                ) : (
                  <div key={alerta.id}>{contenido}</div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-6 text-sm text-zinc-600 shadow-sm ring-1 ring-zinc-200">
              No hay alertas pendientes. Todo en orden.
            </div>
          )}
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
              href="/balance"
              titulo="Balance"
              icono="⚖️"
              descripcion="Precios de venta diarios"
            />
            <AccesoRapido
              href="/cobranza"
              titulo="Cobranza"
              icono="💳"
              descripcion="Cartera y pagos pendientes"
            />
            <AccesoRapido
              href="/dashboard/reportes"
              titulo="Reportes"
              icono="📊"
              descripcion="Indicadores del negocio"
            />
            <AccesoRapido
              href="/usuarios"
              titulo="Usuarios"
              icono="👤"
              descripcion="Accesos del equipo"
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
                Últimas acciones registradas en el sistema.
              </p>
            </div>
            <Link
              href="/dashboard/pedidos"
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Ver todos los pedidos
            </Link>
          </div>

          {actividades.length > 0 ? (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200">
              <div className="divide-y divide-zinc-100">
                {actividades.map((actividad) => (
                  <div
                    key={actividad.id}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900">
                        {actividad.texto}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {actividad.detalle}
                      </p>
                    </div>
                    <div className="text-right text-sm text-zinc-600">
                      <p>{formatearFechaPedido(actividad.fecha)}</p>
                      <p className="font-medium text-zinc-800">
                        {formatearHoraPedido(actividad.fecha)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-8 text-center text-zinc-600 shadow-sm ring-1 ring-zinc-200">
              Aún no hay actividad registrada.
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
