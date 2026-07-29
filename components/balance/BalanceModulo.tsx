"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import VolverAlDashboardLink from "@/components/navegacion/VolverAlDashboardLink";
import { formatearMoneda } from "@/lib/dashboard-admin";
import {
  PASOS_BALANCE,
  PRODUCTOS_BALANCE,
  calcularCostoTotalCompra,
  calcularDiferenciaPrecio,
  calcularResultadosBalance,
  crearPreciosMercadoInicial,
  crearRendimientoInicial,
  crearResultadosInicial,
  fechaBalanceHoy,
  formatearNumeroBalance,
  parsearNumero,
  resultadosCalculadosAString,
  sumarKilosRendimiento,
  type CompraDiaState,
  type PreciosMercadoState,
  type RendimientoState,
  type ResultadosState,
} from "@/lib/balance";

const inputClass =
  "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

const inputTablaClass =
  "w-full min-w-[5rem] rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900";

type SeccionProps = {
  id: string;
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
  className?: string;
};

function SeccionBalance({
  id,
  titulo,
  descripcion,
  children,
  className = "",
}: SeccionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className={`rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 ${className}`}
    >
      <div className="mb-5">
        <h2
          id={`${id}-titulo`}
          className="text-lg font-semibold tracking-tight text-zinc-900"
        >
          {titulo}
        </h2>
        {descripcion ? (
          <p className="mt-1 text-sm text-zinc-500">{descripcion}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function CampoCompra({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-zinc-700"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function CampoResultado({
  label,
  htmlFor,
  value,
  onChange,
  suffix,
}: {
  label: string;
  htmlFor: string;
  value: string;
  onChange: (valor: string) => void;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium uppercase tracking-wide text-zinc-500"
      >
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id={htmlFor}
          type="number"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} text-lg font-bold tabular-nums`}
          placeholder="0"
        />
        {suffix ? (
          <span className="text-sm font-medium text-zinc-500">{suffix}</span>
        ) : null}
      </div>
    </div>
  );
}

function formatearDiferencia(diferencia: number | null): string {
  if (diferencia === null) return "—";
  const prefijo = diferencia > 0 ? "+" : "";
  return `${prefijo}${formatearMoneda(diferencia)}`;
}

function claseDiferencia(diferencia: number | null): string {
  if (diferencia === null) return "text-zinc-400";
  if (diferencia > 0) return "font-medium text-emerald-700";
  if (diferencia < 0) return "font-medium text-red-600";
  return "text-zinc-600";
}

export default function BalanceModulo() {
  const [pasoActual, setPasoActual] = useState(0);
  const [compra, setCompra] = useState<CompraDiaState>({
    fecha: fechaBalanceHoy(),
    numeroPuercos: "",
    kilosTotales: "",
    precioCompraKg: "",
    gastosAdicionales: "",
  });
  const [costoTotal, setCostoTotal] = useState("");
  const [rendimiento, setRendimiento] = useState<RendimientoState>(
    crearRendimientoInicial
  );
  const [precios, setPrecios] = useState<PreciosMercadoState>(
    crearPreciosMercadoInicial
  );
  const [resultados, setResultados] = useState<ResultadosState>(
    crearResultadosInicial
  );

  const costoTotalManual = useRef(false);
  const resultadosManual = useRef<Partial<Record<keyof ResultadosState, boolean>>>(
    {}
  );

  const paso = PASOS_BALANCE[pasoActual];
  const esPrimerPaso = pasoActual === 0;
  const esUltimoPaso = pasoActual === PASOS_BALANCE.length - 1;

  const costoCalculado = useMemo(
    () => calcularCostoTotalCompra(compra),
    [compra]
  );

  const calculados = useMemo(
    () =>
      calcularResultadosBalance(compra, rendimiento, precios, costoTotal),
    [compra, rendimiento, precios, costoTotal]
  );

  const totalKilosRendimiento = useMemo(
    () => sumarKilosRendimiento(rendimiento),
    [rendimiento]
  );

  const listaPrecios = useMemo(() => {
    return PRODUCTOS_BALANCE.map((producto) => {
      const miPrecio = precios[producto.id].miPrecio.trim();
      return {
        ...producto,
        precioMostrar: miPrecio || "—",
      };
    });
  }, [precios]);

  useEffect(() => {
    if (!costoTotalManual.current && costoCalculado !== null) {
      setCostoTotal(formatearNumeroBalance(costoCalculado));
    }
  }, [costoCalculado]);

  useEffect(() => {
    const auto = resultadosCalculadosAString(calculados);

    setResultados((prev) => {
      const next = { ...prev };
      (Object.keys(auto) as (keyof ResultadosState)[]).forEach((campo) => {
        if (!resultadosManual.current[campo]) {
          next[campo] = auto[campo];
        }
      });
      return next;
    });
  }, [calculados]);

  useEffect(() => {
    costoTotalManual.current = false;
    resultadosManual.current = {};
  }, [
    compra.kilosTotales,
    compra.precioCompraKg,
    compra.gastosAdicionales,
    compra.numeroPuercos,
    rendimiento,
    precios,
  ]);

  function actualizarCompra(campo: keyof CompraDiaState, valor: string) {
    setCompra((prev) => ({ ...prev, [campo]: valor }));
  }

  function actualizarCostoTotal(valor: string) {
    costoTotalManual.current = true;
    setCostoTotal(valor);
  }

  function actualizarRendimiento(productoId: string, kilos: string) {
    setRendimiento((prev) => ({ ...prev, [productoId]: kilos }));
  }

  function actualizarPrecio(
    productoId: string,
    campo: "precioMercado" | "miPrecio",
    valor: string
  ) {
    setPrecios((prev) => ({
      ...prev,
      [productoId]: {
        ...prev[productoId as keyof PreciosMercadoState],
        [campo]: valor,
      },
    }));
  }

  function actualizarResultado(campo: keyof ResultadosState, valor: string) {
    resultadosManual.current[campo] = true;
    setResultados((prev) => ({ ...prev, [campo]: valor }));

    if (campo === "costoTotal") {
      costoTotalManual.current = true;
      setCostoTotal(valor);
    }
  }

  function irAnterior() {
    if (esPrimerPaso) return;
    setPasoActual((prev) => prev - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function irSiguiente() {
    if (esUltimoPaso) return;
    setPasoActual((prev) => prev + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderPasoActual() {
    switch (paso.id) {
      case "compra-dia":
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoCompra label="Fecha" htmlFor="balance-fecha">
              <input
                id="balance-fecha"
                type="date"
                value={compra.fecha}
                onChange={(event) =>
                  actualizarCompra("fecha", event.target.value)
                }
                className={inputClass}
              />
            </CampoCompra>

            <CampoCompra label="Número de puercos" htmlFor="balance-puercos">
              <input
                id="balance-puercos"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={compra.numeroPuercos}
                onChange={(event) =>
                  actualizarCompra("numeroPuercos", event.target.value)
                }
                className={inputClass}
              />
            </CampoCompra>

            <CampoCompra label="Kilos totales" htmlFor="balance-kilos">
              <input
                id="balance-kilos"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={compra.kilosTotales}
                onChange={(event) =>
                  actualizarCompra("kilosTotales", event.target.value)
                }
                className={inputClass}
              />
            </CampoCompra>

            <CampoCompra
              label="Precio de compra por kilogramo"
              htmlFor="balance-precio-kg"
            >
              <input
                id="balance-precio-kg"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={compra.precioCompraKg}
                onChange={(event) =>
                  actualizarCompra("precioCompraKg", event.target.value)
                }
                className={inputClass}
              />
            </CampoCompra>

            <CampoCompra label="Gastos adicionales" htmlFor="balance-gastos">
              <input
                id="balance-gastos"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={compra.gastosAdicionales}
                onChange={(event) =>
                  actualizarCompra("gastosAdicionales", event.target.value)
                }
                className={inputClass}
              />
            </CampoCompra>

            <CampoCompra
              label="Costo total"
              htmlFor="balance-costo-total"
              hint="Se actualiza al capturar kilos, precio y gastos. También puedes editarlo manualmente."
            >
              <input
                id="balance-costo-total"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={costoTotal}
                onChange={(event) => actualizarCostoTotal(event.target.value)}
                className={inputClass}
              />
            </CampoCompra>
          </div>
        );

      case "rendimiento":
        return (
          <div className="overflow-x-auto rounded-xl ring-1 ring-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-semibold text-zinc-700"
                  >
                    Producto
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold text-zinc-700"
                  >
                    Kilos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {PRODUCTOS_BALANCE.map((producto) => (
                  <tr key={producto.id} className="hover:bg-zinc-50/80">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {producto.nombreRendimiento}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={rendimiento[producto.id]}
                        onChange={(event) =>
                          actualizarRendimiento(
                            producto.id,
                            event.target.value
                          )
                        }
                        className={`${inputTablaClass} text-right`}
                        aria-label={`Kilos de ${producto.nombreRendimiento}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-zinc-50">
                <tr>
                  <td className="px-4 py-3 font-semibold text-zinc-900">
                    Total kilos
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-zinc-900">
                    {totalKilosRendimiento !== null
                      ? formatearNumeroBalance(totalKilosRendimiento)
                      : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );

      case "precios-mercado":
        return (
          <div className="overflow-x-auto rounded-xl ring-1 ring-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left font-semibold text-zinc-700"
                  >
                    Producto
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold text-zinc-700"
                  >
                    Precio mercado
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold text-zinc-700"
                  >
                    Mi precio
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right font-semibold text-zinc-700"
                  >
                    Diferencia
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {PRODUCTOS_BALANCE.map((producto) => {
                  const fila = precios[producto.id];
                  const diferencia = calcularDiferenciaPrecio(
                    fila.precioMercado,
                    fila.miPrecio
                  );

                  return (
                    <tr key={producto.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {producto.nombreRendimiento}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={fila.precioMercado}
                          onChange={(event) =>
                            actualizarPrecio(
                              producto.id,
                              "precioMercado",
                              event.target.value
                            )
                          }
                          className={`${inputTablaClass} text-right`}
                          aria-label={`Precio de mercado de ${producto.nombreRendimiento}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={fila.miPrecio}
                          onChange={(event) =>
                            actualizarPrecio(
                              producto.id,
                              "miPrecio",
                              event.target.value
                            )
                          }
                          className={`${inputTablaClass} text-right`}
                          aria-label={`Mi precio de ${producto.nombreRendimiento}`}
                        />
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums ${claseDiferencia(diferencia)}`}
                      >
                        {formatearDiferencia(diferencia)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );

      case "resultados":
        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CampoResultado
              label="Venta total"
              htmlFor="resultado-venta-total"
              value={resultados.ventaTotal}
              onChange={(valor) => actualizarResultado("ventaTotal", valor)}
            />
            <CampoResultado
              label="Costo total"
              htmlFor="resultado-costo-total"
              value={resultados.costoTotal}
              onChange={(valor) => actualizarResultado("costoTotal", valor)}
            />
            <CampoResultado
              label="Utilidad total"
              htmlFor="resultado-utilidad-total"
              value={resultados.utilidadTotal}
              onChange={(valor) => actualizarResultado("utilidadTotal", valor)}
            />
            <CampoResultado
              label="Utilidad por puerco"
              htmlFor="resultado-utilidad-puerco"
              value={resultados.utilidadPorPuerco}
              onChange={(valor) =>
                actualizarResultado("utilidadPorPuerco", valor)
              }
            />
            <CampoResultado
              label="Utilidad por kilogramo"
              htmlFor="resultado-utilidad-kg"
              value={resultados.utilidadPorKilogramo}
              onChange={(valor) =>
                actualizarResultado("utilidadPorKilogramo", valor)
              }
            />
            <CampoResultado
              label="Margen"
              htmlFor="resultado-margen"
              value={resultados.margen}
              onChange={(valor) => actualizarResultado("margen", valor)}
              suffix="%"
            />
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <VolverAlDashboardLink />

        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            COCATO
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
            Balance del día
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Captura la compra, el rendimiento y los precios. Los totales se
            actualizan mientras escribes.
          </p>
        </header>

        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {PASOS_BALANCE.map((item, indice) => {
              const activo = indice === pasoActual;
              const completado = indice < pasoActual;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPasoActual(indice);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    activo
                      ? "bg-zinc-900 text-white"
                      : completado
                        ? "bg-zinc-200 text-zinc-700 hover:bg-zinc-300"
                        : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  {indice + 1}. {item.titulo}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            Paso {pasoActual + 1} de {PASOS_BALANCE.length}: {paso.titulo}
          </p>
        </div>

        <div className="grid gap-8 xl:grid-cols-3">
          <div className="space-y-8 xl:col-span-2">
            <SeccionBalance
              id={paso.id}
              titulo={paso.titulo}
              descripcion={paso.descripcion}
            >
              {renderPasoActual()}
            </SeccionBalance>

            <section
              aria-label="Acciones del balance"
              className="rounded-2xl border border-dashed border-zinc-300 bg-white/80 p-6"
            >
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={irAnterior}
                  disabled={esPrimerPaso}
                  className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={irSiguiente}
                  disabled={esUltimoPaso}
                  className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Siguiente
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
                >
                  Publicar Lista de Precios
                </button>
              </div>
            </section>
          </div>

          <aside className="xl:col-span-1">
            <div className="sticky top-8 space-y-4">
              <SeccionBalance
                id="lista-precios-dia"
                titulo="Lista de precios del día"
                descripcion="Vista previa de la lista que utilizarán los trabajadores."
              >
                <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-zinc-200">
                  {listaPrecios.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-4 bg-white px-4 py-3 first:rounded-t-xl last:rounded-b-xl"
                    >
                      <span className="font-medium text-zinc-900">
                        {item.nombreLista}
                      </span>
                      <span className="tabular-nums text-zinc-600">
                        {item.precioMostrar === "—"
                          ? item.precioMostrar
                          : formatearMoneda(Number(item.precioMostrar))}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                  <p className="font-medium text-zinc-700">
                    Última actualización:
                  </p>
                  <p className="mt-1 text-zinc-500">Sin publicar</p>
                </div>

                <div className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-500">Venta total</span>
                    <span className="font-medium tabular-nums text-zinc-900">
                      {parsearNumero(resultados.ventaTotal) !== null
                        ? formatearMoneda(parsearNumero(resultados.ventaTotal)!)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-500">Costo total</span>
                    <span className="font-medium tabular-nums text-zinc-900">
                      {parsearNumero(resultados.costoTotal) !== null
                        ? formatearMoneda(parsearNumero(resultados.costoTotal)!)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-500">Utilidad total</span>
                    <span className="font-medium tabular-nums text-emerald-700">
                      {parsearNumero(resultados.utilidadTotal) !== null
                        ? formatearMoneda(
                            parsearNumero(resultados.utilidadTotal)!
                          )
                        : "—"}
                    </span>
                  </div>
                </div>
              </SeccionBalance>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
