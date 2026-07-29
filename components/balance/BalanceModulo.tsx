"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import VolverAlDashboardLink from "@/components/navegacion/VolverAlDashboardLink";
import {
  cargarBorradorBalanceLocal,
  cargarListaPreciosPublicadaLocal,
  cargarPreciosAnterioresGuardadosLocal,
  guardarBorradorBalance,
  guardarPreciosBalance,
  preciosAnterioresDesdePreciosGuardados,
  publicarBalance,
  type BalanceBorradorLocal,
} from "@/lib/balance-guardado";
import { PublicacionBalanceError } from "@/lib/balance-publicacion";
import {
  ETIQUETAS_INDICADOR,
  PASOS_BALANCE,
  PRODUCTOS_BALANCE,
  PRODUCTOS_CAPOTE_IDS,
  PRODUCTOS_SUBPRODUCTO_IDS,
  calcularCapoteTotal,
  calcularCostoTotalCompra,
  calcularPrecioCanal,
  calcularResultadosBalance,
  calcularValorCapoteTotal,
  calcularValorSubproductosTotal,
  clonarPrecios,
  clonarPreciosAnteriores,
  crearPreciosAnterioresInicial,
  crearPreciosInicial,
  crearRendimientoInicial,
  crearResultadosInicial,
  fechaBalanceHoy,
  formatearNumeroBalance,
  formatearPesosEnteros,
  formatearPesosEnterosInput,
  indicePasoPrecios,
  indicadorDesdeMargen,
  normalizarPreciosAnterioresEnteros,
  normalizarPreciosEnteros,
  parsearNumero,
  preciosAnterioresComoNumeros,
  resultadosCalculadosAString,
  sumarKilosRendimiento,
  type CompraDiaState,
  type PreciosAnterioresState,
  type PreciosState,
  type ProductoBalanceId,
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

function TarjetaResumenCanal({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {titulo}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">
        {valor}
      </p>
    </div>
  );
}

function TarjetaIndicadorComposicion({
  titulo,
  valor,
  expandido,
  onToggle,
  productos,
}: {
  titulo: string;
  valor: string;
  expandido: boolean;
  onToggle: () => void;
  productos: string[];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
        aria-expanded={expandido}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {titulo}
        </p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">
          {valor}
        </p>
        <span className="mt-2 inline-block text-xs text-zinc-500">
          {expandido ? "Ocultar composición" : "Ver composición"}
        </span>
      </button>
      {expandido ? (
        <ul className="mt-3 list-disc space-y-1 border-t border-zinc-200 pt-3 pl-5 text-sm text-zinc-600">
          {productos.map((nombre) => (
            <li key={nombre}>{nombre}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function TarjetaResultado({
  titulo,
  valor,
}: {
  titulo: string;
  valor: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {titulo}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">
        {valor}
      </p>
    </div>
  );
}

function formatearUltimaActualizacion(iso: string | null): string {
  if (!iso) {
    return "Sin publicar";
  }

  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function BalanceModulo() {
  const indicePrecios = indicePasoPrecios();

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
  const [capoteReal, setCapoteReal] = useState("");
  const [rendimientoParaPrecios, setRendimientoParaPrecios] =
    useState<RendimientoState>(crearRendimientoInicial);
  const [capoteRealParaPrecios, setCapoteRealParaPrecios] = useState("");
  const [precios, setPrecios] = useState<PreciosState>(crearPreciosInicial);
  const [preciosAnteriores, setPreciosAnteriores] =
    useState<PreciosAnterioresState>(crearPreciosAnterioresInicial);
  const [preciosGuardados, setPreciosGuardados] =
    useState<PreciosState>(crearPreciosInicial);
  const [tieneHistorialPublicado, setTieneHistorialPublicado] = useState(false);
  const [precioCanalAnteriorPublicado, setPrecioCanalAnteriorPublicado] =
    useState<number | null>(null);
  const [resultados, setResultados] = useState<ResultadosState>(
    crearResultadosInicial
  );
  const [guardandoPrecios, setGuardandoPrecios] = useState(false);
  const [guardandoBorrador, setGuardandoBorrador] = useState(false);
  const [guardandoPublicacion, setGuardandoPublicacion] = useState(false);
  const [mensajePreciosGuardados, setMensajePreciosGuardados] = useState<
    string | null
  >(null);
  const [mensajeBorrador, setMensajeBorrador] = useState<string | null>(null);
  const [mensajePublicacion, setMensajePublicacion] = useState<string | null>(
    null
  );
  const [composicionExpandida, setComposicionExpandida] = useState<
    "capote" | "subproductos" | null
  >(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(
    null
  );

  const costoTotalManual = useRef(false);
  const capoteRealManual = useRef(false);
  const historialInicializado = useRef(false);

  const paso = PASOS_BALANCE[pasoActual];
  const esPrimerPaso = pasoActual === 0;
  const esUltimoPaso = pasoActual === PASOS_BALANCE.length - 1;
  const enPreciosOPosterior = pasoActual >= indicePrecios;

  const costoCalculado = useMemo(
    () => calcularCostoTotalCompra(compra),
    [compra]
  );

  const totalKilosRendimiento = useMemo(
    () => sumarKilosRendimiento(rendimiento),
    [rendimiento]
  );

  const capoteCalculado = useMemo(
    () => calcularCapoteTotal(rendimiento),
    [rendimiento]
  );

  const preciosAnterioresNumeros = useMemo(
    () => preciosAnterioresComoNumeros(preciosAnteriores),
    [preciosAnteriores]
  );

  const calculados = useMemo(
    () =>
      calcularResultadosBalance(
        compra,
        rendimientoParaPrecios,
        preciosGuardados,
        costoTotal
      ),
    [compra.numeroPuercos, rendimientoParaPrecios, preciosGuardados, costoTotal]
  );

  const calculadosSimulacion = useMemo(
    () =>
      calcularResultadosBalance(
        compra,
        rendimientoParaPrecios,
        precios,
        costoTotal
      ),
    [compra.numeroPuercos, rendimientoParaPrecios, precios, costoTotal]
  );

  const preciosSimulacionNumeros = useMemo(
    () =>
      PRODUCTOS_BALANCE.reduce(
        (acc, producto) => {
          const valor = parsearNumero(precios[producto.id].precioNuevo);
          if (valor !== null) acc[producto.id] = valor;
          return acc;
        },
        {} as Record<ProductoBalanceId, number>
      ),
    [precios]
  );

  const valorCapote = useMemo(
    () =>
      calcularValorCapoteTotal(
        preciosSimulacionNumeros,
        rendimientoParaPrecios
      ),
    [preciosSimulacionNumeros, rendimientoParaPrecios]
  );

  const valorSubproductos = useMemo(
    () =>
      calcularValorSubproductosTotal(
        preciosSimulacionNumeros,
        rendimientoParaPrecios
      ),
    [preciosSimulacionNumeros, rendimientoParaPrecios]
  );

  const nombresCapote = useMemo(
    () =>
      PRODUCTOS_CAPOTE_IDS.map(
        (id) => PRODUCTOS_BALANCE.find((item) => item.id === id)!.nombreRendimiento
      ),
    []
  );

  const nombresSubproductos = useMemo(
    () =>
      PRODUCTOS_SUBPRODUCTO_IDS.map(
        (id) => PRODUCTOS_BALANCE.find((item) => item.id === id)!.nombreRendimiento
      ),
    []
  );

  function alternarComposicion(tipo: "capote" | "subproductos") {
    setComposicionExpandida((actual) => (actual === tipo ? null : tipo));
  }

  const hayCambiosSinGuardar = useMemo(() => {
    const borrador = normalizarPreciosEnteros(precios);
    const guardados = normalizarPreciosEnteros(preciosGuardados);

    return PRODUCTOS_BALANCE.some(
      (producto) =>
        borrador[producto.id].precioNuevo !== guardados[producto.id].precioNuevo
    );
  }, [precios, preciosGuardados]);

  const precioCanalActual = useMemo(() => {
    const preciosNuevos = PRODUCTOS_BALANCE.reduce(
      (acc, producto) => {
        const valor = parsearNumero(precios[producto.id].precioNuevo);
        if (valor !== null) acc[producto.id] = valor;
        return acc;
      },
      {} as Record<ProductoBalanceId, number>
    );

    return calcularPrecioCanal(preciosNuevos, rendimientoParaPrecios);
  }, [precios, rendimientoParaPrecios]);

  const indicador = useMemo(
    () => indicadorDesdeMargen(calculados.margen),
    [calculados.margen]
  );

  const listaPrecios = useMemo(() => {
    const fuente = paso.id === "precios" ? precios : preciosGuardados;

    return PRODUCTOS_BALANCE.map((producto) => {
      const precioNuevo = parsearNumero(fuente[producto.id].precioNuevo);
      return {
        ...producto,
        precioMostrar: precioNuevo,
      };
    });
  }, [paso.id, precios, preciosGuardados]);

  const metricasPrecios = useMemo(() => {
    if (paso.id === "precios") return calculadosSimulacion;
    return calculados;
  }, [paso.id, calculadosSimulacion, calculados]);

  const tienePreciosGuardados = useMemo(
    () =>
      PRODUCTOS_BALANCE.some(
        (producto) =>
          parsearNumero(preciosGuardados[producto.id].precioNuevo) !== null
      ),
    [preciosGuardados]
  );

  useEffect(() => {
    if (historialInicializado.current) return;
    historialInicializado.current = true;

    const listaPublicada = cargarListaPreciosPublicadaLocal();
    const borrador = cargarBorradorBalanceLocal();

    if (borrador) {
      setCompra(borrador.compra);
      setCostoTotal(borrador.costoTotal);
      setRendimiento(borrador.rendimiento);
      setCapoteReal(borrador.capoteReal);
      setRendimientoParaPrecios(borrador.rendimientoParaPrecios);
      setCapoteRealParaPrecios(borrador.capoteRealParaPrecios);
    }

    if (listaPublicada) {
      const preciosBase = clonarPrecios(listaPublicada.precios);
      setPreciosAnteriores(
        preciosAnterioresDesdePreciosGuardados(preciosBase)
      );
      setPrecios(preciosBase);
      setPreciosGuardados(preciosBase);
      setPrecioCanalAnteriorPublicado(listaPublicada.precioCanal);
      setUltimaActualizacion(listaPublicada.publicadoEn);
      setTieneHistorialPublicado(true);
    } else if (borrador) {
      setPreciosAnteriores(
        borrador.preciosAnteriores ?? crearPreciosAnterioresInicial()
      );
      setPrecios(borrador.preciosGuardados);
      setPreciosGuardados(borrador.preciosGuardados);
      if (borrador.actualizadoEn) {
        setUltimaActualizacion(borrador.actualizadoEn);
      }
      if (borrador.preciosAnteriores) {
        setTieneHistorialPublicado(true);
      }
    } else {
      const anterioresGuardados = cargarPreciosAnterioresGuardadosLocal();
      if (anterioresGuardados) {
        setPreciosAnteriores(anterioresGuardados);
        setTieneHistorialPublicado(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!costoTotalManual.current && costoCalculado !== null) {
      setCostoTotal(formatearNumeroBalance(costoCalculado));
    }
  }, [costoCalculado]);

  useEffect(() => {
    if (!capoteRealManual.current && capoteCalculado !== null) {
      setCapoteReal(formatearNumeroBalance(capoteCalculado));
    }
  }, [capoteCalculado]);

  useEffect(() => {
    if (!enPreciosOPosterior) return;
    setResultados(resultadosCalculadosAString(calculados));
  }, [calculados, enPreciosOPosterior]);

  useEffect(() => {
    costoTotalManual.current = false;
  }, [
    compra.kilosTotales,
    compra.precioCompraKg,
    compra.gastosAdicionales,
  ]);

  useEffect(() => {
    capoteRealManual.current = false;
  }, [
    rendimiento.costilla,
    rendimiento.pierna,
    rendimiento.espaldilla,
    rendimiento.espinazo,
  ]);

  function actualizarSnapshotPrecios() {
    setRendimientoParaPrecios({ ...rendimiento });
    setCapoteRealParaPrecios(capoteReal);
  }

  function irAPaso(indice: number) {
    if (indice >= indicePrecios && pasoActual < indicePrecios) {
      actualizarSnapshotPrecios();
    }
    setPasoActual(indice);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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

  function actualizarCapoteReal(valor: string) {
    capoteRealManual.current = true;
    setCapoteReal(valor);
  }

  function crearBorradorActual(
    preciosParaGuardar: PreciosState = preciosGuardados
  ): BalanceBorradorLocal {
    return {
      compra,
      costoTotal,
      rendimiento,
      capoteReal,
      rendimientoParaPrecios,
      capoteRealParaPrecios,
      preciosAnteriores: clonarPreciosAnteriores(preciosAnteriores),
      preciosGuardados: clonarPrecios(preciosParaGuardar),
      actualizadoEn: new Date().toISOString(),
    };
  }

  async function handleGuardarPrecios() {
    setGuardandoPrecios(true);
    setMensajePreciosGuardados(null);

    try {
      const normalizados = normalizarPreciosEnteros(precios);
      const guardados = clonarPrecios(normalizados);
      const nuevosAnteriores = normalizarPreciosAnterioresEnteros(
        preciosAnterioresDesdePreciosGuardados(guardados)
      );

      const { actualizadoEn } = await guardarPreciosBalance({
        ...crearBorradorActual(guardados),
        preciosAnteriores: nuevosAnteriores,
      });

      setPrecios(normalizados);
      setPreciosGuardados(guardados);
      setPreciosAnteriores(nuevosAnteriores);
      setTieneHistorialPublicado(true);
      setUltimaActualizacion(actualizadoEn);

      const nuevosResultados = resultadosCalculadosAString(
        calcularResultadosBalance(
          compra,
          rendimientoParaPrecios,
          guardados,
          costoTotal
        )
      );
      setResultados(nuevosResultados);
      setMensajePreciosGuardados("Precios guardados correctamente.");
    } catch {
      setMensajePreciosGuardados(
        "No se pudieron guardar los precios. Intenta de nuevo."
      );
    } finally {
      setGuardandoPrecios(false);
    }
  }

  async function handleGuardarBorrador() {
    setGuardandoBorrador(true);
    setMensajeBorrador(null);

    try {
      await guardarBorradorBalance(crearBorradorActual());
      setMensajeBorrador("Borrador guardado correctamente.");
    } catch {
      setMensajeBorrador("No se pudo guardar el borrador. Intenta de nuevo.");
    } finally {
      setGuardandoBorrador(false);
    }
  }

  async function handlePublicar() {
    setGuardandoPublicacion(true);
    setMensajePublicacion(null);

    try {
      const canalPublicado =
        precioCanalActual ??
        calcularPrecioCanal(
          PRODUCTOS_BALANCE.reduce(
            (acc, producto) => {
              const valor = parsearNumero(
                preciosGuardados[producto.id].precioNuevo
              );
              if (valor !== null) acc[producto.id] = valor;
              return acc;
            },
            {} as Record<ProductoBalanceId, number>
          ),
          rendimientoParaPrecios
        );

      const preciosPublicar = normalizarPreciosEnteros(
        hayCambiosSinGuardar ? precios : preciosGuardados
      );
      const guardados = clonarPrecios(preciosPublicar);
      const nuevosAnteriores = normalizarPreciosAnterioresEnteros(
        preciosAnterioresDesdePreciosGuardados(guardados)
      );

      const { publicadoEn } = await publicarBalance(
        {
          ...crearBorradorActual(guardados),
          preciosAnteriores: nuevosAnteriores,
        },
        canalPublicado
      );

      setPrecios(guardados);
      setPreciosGuardados(guardados);
      setPreciosAnteriores(nuevosAnteriores);
      setPrecioCanalAnteriorPublicado(canalPublicado);
      setTieneHistorialPublicado(true);
      setUltimaActualizacion(publicadoEn);
      setMensajePublicacion("Balance publicado correctamente.");
    } catch (error) {
      const mensaje =
        error instanceof PublicacionBalanceError
          ? error.message
          : "No se pudo publicar el balance. Intenta de nuevo.";
      setMensajePublicacion(mensaje);
    } finally {
      setGuardandoPublicacion(false);
    }
  }

  function actualizarPrecioAnterior(
    productoId: ProductoBalanceId,
    valor: string
  ) {
    setMensajePreciosGuardados(null);
    setPreciosAnteriores((prev) => ({
      ...prev,
      [productoId]: { precio: valor },
    }));
  }

  function actualizarPrecioNuevo(
    productoId: ProductoBalanceId,
    valor: string
  ) {
    setMensajePreciosGuardados(null);
    setPrecios((prev) => ({
      ...prev,
      [productoId]: { precioNuevo: valor },
    }));
  }

  function irAnterior() {
    if (esPrimerPaso) return;
    irAPaso(pasoActual - 1);
  }

  function irSiguiente() {
    if (esUltimoPaso) return;
    irAPaso(pasoActual + 1);
  }

  function renderPanelLateral() {
    if (paso.id === "rendimiento") {
      return (
        <SeccionBalance
          id="resumen-kilos"
          titulo="Resumen de kilos"
          descripcion="Totales capturados en este paso."
        >
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 rounded-lg bg-zinc-50 px-4 py-3">
              <span className="text-zinc-500">Total kilos</span>
              <span className="font-semibold tabular-nums text-zinc-900">
                {totalKilosRendimiento !== null
                  ? formatearNumeroBalance(totalKilosRendimiento)
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4 rounded-lg bg-amber-50 px-4 py-3">
              <span className="text-zinc-600">Capote calculado (kg)</span>
              <span className="font-semibold tabular-nums text-amber-800">
                {capoteCalculado !== null
                  ? formatearNumeroBalance(capoteCalculado)
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4 rounded-lg border border-amber-200 bg-white px-4 py-3">
              <span className="text-zinc-600">Capote real (kg)</span>
              <span className="font-semibold tabular-nums text-zinc-900">
                {capoteReal || "—"}
              </span>
            </div>
          </div>
        </SeccionBalance>
      );
    }

    if (paso.id === "precios" || paso.id === "resultados") {
      return (
        <SeccionBalance
          id="lista-precios-dia"
          titulo={
            paso.id === "precios"
              ? "Simulación en tiempo real"
              : "Lista de precios del día"
          }
          descripcion={
            paso.id === "precios"
              ? "Los indicadores se actualizan al modificar el precio nuevo."
              : "Vista previa con los precios guardados."
          }
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
                  {formatearPesosEnteros(item.precioMostrar)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
            <p className="font-medium text-zinc-700">Última actualización:</p>
            <p className="mt-1 text-zinc-500">
              {formatearUltimaActualizacion(ultimaActualizacion)}
            </p>
          </div>

          <div className="mt-4 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
            {paso.id === "precios" ? (
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">Valor del capote</span>
                <span className="font-medium tabular-nums text-zinc-900">
                  {formatearPesosEnteros(valorCapote)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Utilidad por puerco</span>
              <span className="font-medium tabular-nums text-zinc-900">
                {formatearPesosEnteros(metricasPrecios.utilidadPorPuerco)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Utilidad total</span>
              <span className="font-medium tabular-nums text-emerald-700">
                {formatearPesosEnteros(metricasPrecios.utilidadTotal)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Margen</span>
              <span className="font-medium tabular-nums text-zinc-900">
                {metricasPrecios.margen !== null
                  ? `${formatearNumeroBalance(metricasPrecios.margen, 1)}%`
                  : "—"}
              </span>
            </div>
          </div>
        </SeccionBalance>
      );
    }

    return null;
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
          <div className="space-y-6">
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

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 ring-1 ring-amber-100">
              <h3 className="text-base font-semibold text-zinc-900">
                Resumen del Capote
              </h3>
              <p className="mt-3 text-sm text-zinc-600">
                Capote (kg) = Costillas + Piernas + Espaldillas + Espinazos
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-300 bg-white px-4 py-3 shadow-sm">
                <span className="font-semibold text-zinc-900">
                  Capote calculado (kg)
                </span>
                <span className="text-2xl font-bold tabular-nums text-amber-800">
                  {capoteCalculado !== null
                    ? formatearNumeroBalance(capoteCalculado)
                    : "—"}
                </span>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-zinc-500">
                El Capote representa la suma de Costillas + Piernas +
                Espaldillas + Espinazos.
              </p>
            </div>

            <CampoCompra
              label="Capote real (kg)"
              htmlFor="balance-capote-real"
              hint="Inicia con el valor calculado. Los pasos posteriores usarán este dato."
            >
              <input
                id="balance-capote-real"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={capoteReal}
                onChange={(event) => actualizarCapoteReal(event.target.value)}
                className={inputClass}
              />
            </CampoCompra>
          </div>
        );

      case "precios":
        return (
          <div className="space-y-6">
            {!tieneHistorialPublicado ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Primer balance: captura manualmente los precios anteriores. Al
                guardar, quedarán como referencia para el siguiente balance.
              </p>
            ) : null}

            <p className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Ajusta el <strong>Precio nuevo</strong> de cada producto para
              probar distintos escenarios. Los indicadores se recalculan al
              instante. Cuando encuentres el balance deseado, guarda y publica la
              lista.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <TarjetaIndicadorComposicion
                titulo="Valor del capote"
                valor={formatearPesosEnteros(valorCapote)}
                expandido={composicionExpandida === "capote"}
                onToggle={() => alternarComposicion("capote")}
                productos={nombresCapote}
              />
              <TarjetaIndicadorComposicion
                titulo="Valor de los Subproductos"
                valor={formatearPesosEnteros(valorSubproductos)}
                expandido={composicionExpandida === "subproductos"}
                onToggle={() => alternarComposicion("subproductos")}
                productos={nombresSubproductos}
              />
              <TarjetaResumenCanal
                titulo="Utilidad por puerco"
                valor={formatearPesosEnteros(
                  calculadosSimulacion.utilidadPorPuerco
                )}
              />
              <TarjetaResumenCanal
                titulo="Utilidad total"
                valor={formatearPesosEnteros(
                  calculadosSimulacion.utilidadTotal
                )}
              />
              <TarjetaResumenCanal
                titulo="Margen"
                valor={
                  calculadosSimulacion.margen !== null
                    ? `${formatearNumeroBalance(calculadosSimulacion.margen, 1)}%`
                    : "—"
                }
              />
            </div>

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
                      Precio anterior
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right font-semibold text-zinc-700"
                    >
                      Precio nuevo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {PRODUCTOS_BALANCE.map((producto) => {
                    const anterior = preciosAnterioresNumeros[producto.id];

                    return (
                      <tr key={producto.id} className="hover:bg-zinc-50/80">
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {producto.nombreRendimiento}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {tieneHistorialPublicado ? (
                            <span className="tabular-nums text-zinc-600">
                              {formatearPesosEnteros(anterior)}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0"
                              value={preciosAnteriores[producto.id].precio}
                              onChange={(event) =>
                                actualizarPrecioAnterior(
                                  producto.id,
                                  event.target.value
                                )
                              }
                              className={`${inputTablaClass} text-right`}
                              aria-label={`Precio anterior de ${producto.nombreRendimiento}`}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={precios[producto.id].precioNuevo}
                            onChange={(event) =>
                              actualizarPrecioNuevo(
                                producto.id,
                                event.target.value
                              )
                            }
                            className={`${inputTablaClass} text-right font-medium`}
                            aria-label={`Precio nuevo de ${producto.nombreRendimiento}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGuardarPrecios}
                disabled={guardandoPrecios}
                className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {guardandoPrecios ? "Guardando..." : "Guardar precios"}
              </button>
              {hayCambiosSinGuardar ? (
                <span className="text-sm text-amber-700">
                  Hay cambios sin guardar en la simulación.
                </span>
              ) : tienePreciosGuardados ? (
                <span className="text-sm text-emerald-700">
                  Precios guardados listos para publicar.
                </span>
              ) : null}
            </div>

            {mensajePreciosGuardados ? (
              <p
                className={`text-sm ${
                  mensajePreciosGuardados.includes("correctamente")
                    ? "text-emerald-700"
                    : "text-red-600"
                }`}
                role="status"
              >
                {mensajePreciosGuardados}
              </p>
            ) : null}
          </div>
        );

      case "resultados":
        return (
          <div className="space-y-6">
            {indicador ? (
              <div
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${ETIQUETAS_INDICADOR[indicador].className}`}
              >
                <span className="text-xl" aria-hidden>
                  {ETIQUETAS_INDICADOR[indicador].emoji}
                </span>
                <span className="font-semibold">
                  {ETIQUETAS_INDICADOR[indicador].etiqueta}
                </span>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <TarjetaResultado
                titulo="Utilidad por puerco"
                valor={formatearPesosEnteros(
                  parsearNumero(resultados.utilidadPorPuerco)
                )}
              />
              <TarjetaResultado
                titulo="Utilidad total"
                valor={formatearPesosEnteros(
                  parsearNumero(resultados.utilidadTotal)
                )}
              />
              <TarjetaResultado
                titulo="Margen"
                valor={resultados.margen ? `${resultados.margen}%` : "—"}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  const panelLateral = renderPanelLateral();

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
                  onClick={() => irAPaso(indice)}
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

        <div
          className={`grid gap-8 ${panelLateral ? "xl:grid-cols-3" : "max-w-4xl"}`}
        >
          <div className={`space-y-8 ${panelLateral ? "xl:col-span-2" : ""}`}>
            <SeccionBalance
              id={paso.id}
              titulo={paso.titulo}
              descripcion={paso.descripcion}
            >
              {renderPasoActual()}
            </SeccionBalance>

            <section
              aria-label="Navegación del balance"
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
              </div>
            </section>

            <section
              aria-label="Guardado del balance"
              className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200"
            >
              <h3 className="text-base font-semibold text-zinc-900">Guardado</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Guarda tu avance como borrador o publica el balance como vigente.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleGuardarBorrador}
                  disabled={guardandoBorrador || guardandoPublicacion}
                  className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardandoBorrador ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={handlePublicar}
                  disabled={guardandoBorrador || guardandoPublicacion}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardandoPublicacion ? "Publicando..." : "Publicar"}
                </button>
              </div>
              {mensajeBorrador ? (
                <p className="mt-3 text-sm text-emerald-700" role="status">
                  {mensajeBorrador}
                </p>
              ) : null}
              {mensajePublicacion ? (
                <p className="mt-3 text-sm text-emerald-700" role="status">
                  {mensajePublicacion}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-zinc-400">
                Guardar conserva un borrador. Publicar lo convierte en el balance
                vigente del día.
              </p>
            </section>
          </div>

          {panelLateral ? (
            <aside className="xl:col-span-1">
              <div className="sticky top-8 space-y-4">{panelLateral}</div>
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}
