"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import VolverAlDashboardLink from "@/components/navegacion/VolverAlDashboardLink";
import {
  agruparPedidosPorCliente,
  calcularResumenCartera,
  construirCarteraClientes,
  etiquetaEstadoCreditoCartera,
  type ClienteCartera,
  type EstadoCreditoCartera,
  type PedidoCreditoConCliente,
} from "@/lib/cliente-credito";
import { formatMoneda } from "@/lib/pedido-calculo";

type FiltroCartera = "todos" | EstadoCreditoCartera;

const FILTROS: Array<{ clave: FiltroCartera; etiqueta: string }> = [
  { clave: "todos", etiqueta: "Todos" },
  { clave: "al_corriente", etiqueta: "Al corriente" },
  { clave: "pendiente", etiqueta: "Pendientes" },
  { clave: "bloqueado", etiqueta: "Crédito bloqueado" },
];

function TarjetaResumen({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <article className="rounded-xl bg-white px-4 py-4 shadow-sm ring-1 ring-zinc-200">
      <p className="text-sm font-medium text-zinc-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-zinc-900">{valor}</p>
    </article>
  );
}

export default function CobranzaModulo() {
  const [cartera, setCartera] = useState<ClienteCartera[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroCartera>("todos");

  useEffect(() => {
    void cargarCartera();
  }, []);

  async function cargarCartera() {
    setCargando(true);
    setError(null);

    const [clientesRes, pedidosRes] = await Promise.all([
      supabase
        .from("clientes")
        .select(
          "id, nombre_negocio, limite_credito, tipos_cliente(nombre)"
        )
        .eq("activo", true)
        .order("nombre_negocio"),
      supabase
        .from("pedidos")
        .select(
          "id, cliente_id, total, estado, estado_pago, fecha, pagado_en"
        ),
    ]);

    if (clientesRes.error || pedidosRes.error) {
      setError("No se pudo cargar la cartera de clientes.");
      setCargando(false);
      return;
    }

    const pedidosPorCliente = agruparPedidosPorCliente(
      (pedidosRes.data ?? []) as PedidoCreditoConCliente[]
    );

    setCartera(
      construirCarteraClientes(clientesRes.data ?? [], pedidosPorCliente)
    );
    setCargando(false);
  }

  const resumen = useMemo(() => calcularResumenCartera(cartera), [cartera]);

  const clientesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return cartera.filter((cliente) => {
      const coincideFiltro =
        filtro === "todos" || cliente.estadoCredito === filtro;
      const coincideBusqueda =
        !termino ||
        cliente.nombre_negocio.toLowerCase().includes(termino) ||
        cliente.tipoCliente.toLowerCase().includes(termino);

      return coincideFiltro && coincideBusqueda;
    });
  }, [busqueda, cartera, filtro]);

  return (
    <main className="min-h-screen bg-zinc-100 p-8">
      <VolverAlDashboardLink />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-zinc-900">Cobranza</h1>
        <p className="mt-1 text-zinc-500">Cartera de clientes y pagos pendientes</p>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaResumen
          titulo="Total de clientes"
          valor={String(resumen.totalClientes)}
        />
        <TarjetaResumen
          titulo="Clientes con adeudo"
          valor={String(resumen.clientesConAdeudo)}
        />
        <TarjetaResumen
          titulo="Clientes bloqueados"
          valor={String(resumen.clientesBloqueados)}
        />
        <TarjetaResumen
          titulo="Total por cobrar"
          valor={formatMoneda(resumen.totalPorCobrar)}
        />
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((opcion) => (
          <button
            key={opcion.clave}
            type="button"
            onClick={() => setFiltro(opcion.clave)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              filtro === opcion.clave
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Buscar cliente..."
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        className="mb-6 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />

      {cargando ? (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          Cargando cartera...
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-zinc-500 shadow-sm ring-1 ring-zinc-200">
          No hay clientes que coincidan con el filtro.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="p-3 text-left text-sm font-medium text-zinc-600">
                    Cliente
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-zinc-600">
                    Tipo de cliente
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-zinc-600">
                    Saldo pendiente
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-zinc-600">
                    Límite de crédito
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-zinc-600">
                    Crédito disponible
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-zinc-600">
                    Notas pendientes
                  </th>
                  <th className="p-3 text-left text-sm font-medium text-zinc-600">
                    Estado de crédito
                  </th>
                  <th className="p-3 text-right text-sm font-medium text-zinc-600">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((cliente) => (
                  <tr key={cliente.id} className="border-t border-zinc-100">
                    <td className="p-3 font-medium text-zinc-900">
                      {cliente.nombre_negocio}
                    </td>
                    <td className="p-3 text-zinc-700">{cliente.tipoCliente}</td>
                    <td className="p-3 text-zinc-900">
                      {formatMoneda(cliente.resumen.saldoPendiente)}
                    </td>
                    <td className="p-3 text-zinc-700">
                      {formatMoneda(cliente.resumen.limiteCredito)}
                    </td>
                    <td className="p-3 text-zinc-700">
                      {formatMoneda(cliente.resumen.creditoDisponible)}
                    </td>
                    <td className="p-3 text-zinc-700">
                      {cliente.resumen.notasPendientes}
                    </td>
                    <td className="p-3 text-zinc-700">
                      {etiquetaEstadoCreditoCartera(cliente.estadoCredito)}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/clientes/${cliente.id}`}
                        className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-white"
                      >
                        Ver cuenta
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
