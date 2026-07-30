"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import VolverAlDashboardLink from "@/components/navegacion/VolverAlDashboardLink";
import { formatMoneda } from "@/lib/pedido-calculo";
import {
  calcularIndicadoresReporte,
  cargarDatosReporte,
  type IndicadoresReporte,
} from "@/lib/reportes";
import {
  calcularRangoPeriodo,
  ETIQUETAS_PERIODO,
  type PeriodoReporte,
} from "@/lib/reportes-periodo";

const PERIODOS: PeriodoReporte[] = [
  "hoy",
  "semana",
  "mes",
  "anio",
  "personalizado",
];

function TarjetaIndicador({
  titulo,
  items,
}: {
  titulo: string;
  items: Array<{ etiqueta: string; valor: string }>;
}) {
  return (
    <article className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {titulo}
      </h3>
      <dl className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.etiqueta}>
            <dt className="text-xs text-zinc-500">{item.etiqueta}</dt>
            <dd className="text-lg font-semibold text-zinc-900">{item.valor}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function TablaReporte({
  titulo,
  columnas,
  filas,
  vacio,
}: {
  titulo: string;
  columnas: string[];
  filas: string[][];
  vacio: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
      <div className="border-b border-zinc-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">{titulo}</h2>
      </div>
      {filas.length === 0 ? (
        <div className="p-6 text-sm text-zinc-500">{vacio}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead className="bg-zinc-100">
              <tr>
                {columnas.map((columna) => (
                  <th
                    key={columna}
                    className="p-3 text-left text-sm font-medium text-zinc-600"
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, indice) => (
                <tr key={indice} className="border-t border-zinc-100">
                  {fila.map((celda, celdaIndice) => (
                    <td
                      key={celdaIndice}
                      className={`p-3 text-sm ${
                        celdaIndice === 0
                          ? "font-medium text-zinc-900"
                          : "text-zinc-700"
                      }`}
                    >
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const INDICADORES_VACIOS: IndicadoresReporte = {
  ventas: { total: 0, pedidos: 0, ticketPromedio: 0 },
  productos: { masVendido: "—", kilosVendidos: 0, totalVendido: 0 },
  clientes: { mayorCompra: "—", pedidos: 0, totalComprado: 0 },
  cobranza: {
    totalPendiente: 0,
    clientesConAdeudo: 0,
    clientesBloqueados: 0,
  },
  balance: { utilidadEstimada: 0, margenPromedio: 0 },
  tablas: { productos: [], clientes: [], cobranza: [] },
};

export default function ReportesModulo() {
  const [periodo, setPeriodo] = useState<PeriodoReporte>("mes");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datosBase, setDatosBase] = useState<Awaited<
    ReturnType<typeof cargarDatosReporte>
  > | null>(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);

    try {
      const datos = await cargarDatosReporte();
      setDatosBase(datos);
    } catch {
      setError("No se pudieron cargar los reportes.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const rango = useMemo(
    () => calcularRangoPeriodo(periodo, { desde, hasta }),
    [desde, hasta, periodo]
  );

  const indicadores = useMemo(() => {
    if (!datosBase) return INDICADORES_VACIOS;

    return calcularIndicadoresReporte(
      datosBase.pedidos,
      datosBase.detalles,
      datosBase.balances,
      datosBase.cartera,
      rango
    );
  }, [datosBase, rango]);

  return (
    <main className="min-h-screen bg-zinc-100 p-8">
      <VolverAlDashboardLink />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Reportes</h1>
          <p className="mt-1 text-zinc-500">
            Indicadores del negocio · {rango.etiqueta}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled
            title="Próximamente"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-400"
          >
            Exportar Excel
          </button>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-400"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      <section className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
        <p className="mb-3 text-sm font-medium text-zinc-700">Periodo</p>
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setPeriodo(opcion)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                periodo === opcion
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {ETIQUETAS_PERIODO[opcion]}
            </button>
          ))}
        </div>

        {periodo === "personalizado" ? (
          <div className="mt-4 flex flex-wrap gap-4">
            <div>
              <label
                htmlFor="reportes-desde"
                className="block text-xs font-medium text-zinc-600"
              >
                Desde
              </label>
              <input
                id="reportes-desde"
                type="date"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <div>
              <label
                htmlFor="reportes-hasta"
                className="block text-xs font-medium text-zinc-600"
              >
                Hasta
              </label>
              <input
                id="reportes-hasta"
                type="date"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="mb-6 rounded-xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      {cargando ? (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          Cargando reportes...
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <TarjetaIndicador
              titulo="Ventas"
              items={[
                {
                  etiqueta: "Venta total",
                  valor: formatMoneda(indicadores.ventas.total),
                },
                {
                  etiqueta: "Número de pedidos",
                  valor: String(indicadores.ventas.pedidos),
                },
                {
                  etiqueta: "Ticket promedio",
                  valor: formatMoneda(indicadores.ventas.ticketPromedio),
                },
              ]}
            />
            <TarjetaIndicador
              titulo="Productos"
              items={[
                {
                  etiqueta: "Producto más vendido",
                  valor: indicadores.productos.masVendido,
                },
                {
                  etiqueta: "Kilos vendidos",
                  valor: indicadores.productos.kilosVendidos.toFixed(2),
                },
                {
                  etiqueta: "Total vendido",
                  valor: formatMoneda(indicadores.productos.totalVendido),
                },
              ]}
            />
            <TarjetaIndicador
              titulo="Clientes"
              items={[
                {
                  etiqueta: "Cliente con mayor compra",
                  valor: indicadores.clientes.mayorCompra,
                },
                {
                  etiqueta: "Número de pedidos",
                  valor: String(indicadores.clientes.pedidos),
                },
                {
                  etiqueta: "Total comprado",
                  valor: formatMoneda(indicadores.clientes.totalComprado),
                },
              ]}
            />
            <TarjetaIndicador
              titulo="Cobranza"
              items={[
                {
                  etiqueta: "Total pendiente por cobrar",
                  valor: formatMoneda(indicadores.cobranza.totalPendiente),
                },
                {
                  etiqueta: "Clientes con adeudo",
                  valor: String(indicadores.cobranza.clientesConAdeudo),
                },
                {
                  etiqueta: "Clientes bloqueados",
                  valor: String(indicadores.cobranza.clientesBloqueados),
                },
              ]}
            />
            <TarjetaIndicador
              titulo="Balance"
              items={[
                {
                  etiqueta: "Utilidad estimada",
                  valor: formatMoneda(indicadores.balance.utilidadEstimada),
                },
                {
                  etiqueta: "Margen promedio",
                  valor: `${indicadores.balance.margenPromedio.toFixed(1)}%`,
                },
              ]}
            />
          </div>

          <div className="mt-6 space-y-6">
            <TablaReporte
              titulo="Productos más vendidos"
              columnas={["Producto", "Cantidad vendida", "Total vendido"]}
              filas={indicadores.tablas.productos.map((fila) => [
                fila.producto,
                fila.cantidadVendida.toFixed(2),
                formatMoneda(fila.totalVendido),
              ])}
              vacio="No hay ventas de productos en este periodo."
            />
            <TablaReporte
              titulo="Mejores clientes"
              columnas={["Cliente", "Número de pedidos", "Total comprado"]}
              filas={indicadores.tablas.clientes.map((fila) => [
                fila.cliente,
                String(fila.pedidos),
                formatMoneda(fila.totalComprado),
              ])}
              vacio="No hay compras de clientes en este periodo."
            />
            <TablaReporte
              titulo="Cobranza"
              columnas={[
                "Cliente",
                "Saldo pendiente",
                "Límite de crédito",
                "Estado",
              ]}
              filas={indicadores.tablas.cobranza.map((fila) => [
                fila.cliente,
                formatMoneda(fila.saldoPendiente),
                formatMoneda(fila.limiteCredito),
                fila.estado,
              ])}
              vacio="No hay clientes con adeudo."
            />
          </div>
        </>
      )}
    </main>
  );
}
