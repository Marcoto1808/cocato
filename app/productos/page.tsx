"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CATEGORIAS_PRODUCTO,
  SUBCATEGORIAS_PRODUCTO,
  UNIDADES_PRODUCTO,
  actualizarProducto,
  cambiarEstadoProducto,
  contarProductos,
  crearProducto,
  formatearErrorProducto,
  listarProductos,
  type Producto,
  type ProductoInput,
} from "@/lib/productos";
import {
  DESCRIPCION_TIPO_CALCULO,
  ETIQUETAS_TIPO_CALCULO,
  TIPOS_CALCULO,
  tipoCalculoPorDefecto,
  type TipoCalculoProducto,
} from "@/lib/tipo-calculo-producto";
import ProductosTable from "@/components/productos/ProductosTable";
import VolverAlDashboardLink from "@/components/navegacion/VolverAlDashboardLink";

type FormularioProducto = {
  nombre: string;
  precio_kg: string;
  unidad: string;
  categoria: string;
  subcategoria: string;
  tipo_calculo: TipoCalculoProducto;
  activo: boolean;
};

const FORMULARIO_VACIO: FormularioProducto = {
  nombre: "",
  precio_kg: "",
  unidad: "kg",
  categoria: "Res",
  subcategoria: "Corte",
  tipo_calculo: "POR_KILO",
  activo: true,
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [totales, setTotales] = useState({ total: 0, activos: 0, inactivos: 0 });
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [alternandoId, setAlternandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(
    null
  );
  const [formulario, setFormulario] =
    useState<FormularioProducto>(FORMULARIO_VACIO);

  const cargarProductos = useCallback(async () => {
    setCargando(true);
    setError(null);

    const listado = await listarProductos({
      busqueda: busquedaAplicada,
      categoria: categoriaFiltro,
    });

    if (listado.error) {
      console.error("[productos] select error:", listado.error);
      setError(
        `No se pudieron cargar los productos. ${formatearErrorProducto(listado.error)}`
      );
      setCargando(false);
      return;
    }

    setProductos(listado.productos);
    setCargando(false);
  }, [busquedaAplicada, categoriaFiltro]);

  const cargarTotales = useCallback(async () => {
    const conteos = await contarProductos();

    if (conteos.error) {
      console.error("[productos] conteos error:", conteos.error);
      return;
    }

    setTotales({
      total: conteos.total,
      activos: conteos.activos,
      inactivos: conteos.inactivos,
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBusquedaAplicada(busqueda);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [busqueda]);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  useEffect(() => {
    cargarTotales();
  }, [cargarTotales]);

  async function recargarCatalogo() {
    await Promise.all([cargarProductos(), cargarTotales()]);
  }

  function abrirModalNuevo() {
    setProductoEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setError(null);
    setMensajeExito(null);
    setModalAbierto(true);
  }

  function abrirModalEditar(producto: Producto) {
    setProductoEditando(producto);
    setFormulario({
      nombre: producto.nombre,
      precio_kg: String(producto.precio_kg),
      unidad: producto.unidad,
      categoria: producto.categoria,
      subcategoria: producto.subcategoria,
      tipo_calculo: producto.tipo_calculo,
      activo: producto.activo,
    });
    setError(null);
    setMensajeExito(null);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setProductoEditando(null);
    setFormulario(FORMULARIO_VACIO);
  }

  function construirInput(): ProductoInput | null {
    const nombre = formulario.nombre.trim();
    const precio = Number(formulario.precio_kg);
    const unidad = formulario.unidad.trim();
    const categoria = formulario.categoria.trim();
    const subcategoria = formulario.subcategoria.trim();
    const tipo_calculo = formulario.tipo_calculo;

    if (
      !nombre ||
      !unidad ||
      !categoria ||
      !subcategoria ||
      !tipo_calculo ||
      Number.isNaN(precio) ||
      precio < 0
    ) {
      setError(
        "Completa nombre, categoría, subcategoría, tipo de cálculo, precio válido y unidad."
      );
      return null;
    }

    return {
      nombre,
      precio_kg: precio,
      unidad,
      categoria,
      subcategoria,
      tipo_calculo,
      activo: formulario.activo,
    };
  }

  async function guardarProducto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = construirInput();
    if (!input) return;

    setGuardando(true);
    setError(null);
    setMensajeExito(null);

    const resultado = productoEditando
      ? await actualizarProducto(productoEditando.id, input)
      : await crearProducto(input);

    if (resultado.error || !resultado.producto) {
      console.error("[productos] save error:", resultado.error);
      setError(
        `No se pudo guardar el producto. ${formatearErrorProducto(resultado.error)}`
      );
      setGuardando(false);
      return;
    }

    cerrarModal();
    setGuardando(false);
    setMensajeExito(
      productoEditando
        ? `Producto "${resultado.producto.nombre}" actualizado correctamente.`
        : `Producto "${resultado.producto.nombre}" creado correctamente.`
    );
    await recargarCatalogo();
  }

  async function toggleActivo(producto: Producto) {
    setAlternandoId(producto.id);
    setError(null);
    setMensajeExito(null);

    const resultado = await cambiarEstadoProducto(producto, !producto.activo);

    if (resultado.error || !resultado.producto) {
      console.error("[productos] toggle error:", resultado.error);
      setError(
        `No se pudo actualizar el estado del producto. ${formatearErrorProducto(resultado.error)}`
      );
      setAlternandoId(null);
      return;
    }

    setMensajeExito(
      resultado.producto.activo
        ? `"${resultado.producto.nombre}" activado correctamente.`
        : `"${resultado.producto.nombre}" desactivado correctamente.`
    );
    setAlternandoId(null);
    await recargarCatalogo();
  }

  const sinResultados = useMemo(
    () => !cargando && productos.length === 0,
    [cargando, productos.length]
  );

  const hayFiltrosActivos = useMemo(
    () => Boolean(busquedaAplicada.trim()) || categoriaFiltro !== "Todas",
    [busquedaAplicada, categoriaFiltro]
  );

  return (
    <main className="min-h-screen bg-zinc-100 p-8">
      <VolverAlDashboardLink />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="mt-1 text-zinc-500">Catálogo de productos</p>
        </div>

        <button
          type="button"
          onClick={abrirModalNuevo}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + Nuevo producto
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Total productos</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900">{totales.total}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Activos</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {totales.activos}
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Inactivos</p>
          <p className="mt-2 text-3xl font-bold text-zinc-600">
            {totales.inactivos}
          </p>
        </div>
      </div>

      {mensajeExito && !modalAbierto ? (
        <div className="mb-6 rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          {mensajeExito}
        </div>
      ) : null}

      {error && !modalAbierto ? (
        <div className="mb-6 rounded-xl bg-red-50 px-5 py-4 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row">
        <input
          type="text"
          placeholder="Buscar producto por nombre..."
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 lg:flex-1"
        />

        <select
          value={categoriaFiltro}
          onChange={(event) => setCategoriaFiltro(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 lg:w-56"
        >
          <option value="Todas">Todas las categorías</option>
          {CATEGORIAS_PRODUCTO.map((categoria) => (
            <option key={categoria} value={categoria}>
              {categoria}
            </option>
          ))}
        </select>
      </div>

      {cargando ? (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          Cargando productos...
        </div>
      ) : (
        <ProductosTable
          productos={productos}
          onEditar={abrirModalEditar}
          onToggleActivo={toggleActivo}
          alternandoId={alternandoId}
          sinResultados={sinResultados}
          hayFiltrosActivos={hayFiltrosActivos}
        />
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg ring-1 ring-zinc-200">
            <h2 className="text-xl font-bold text-zinc-900">
              {productoEditando ? "Editar producto" : "Nuevo producto"}
            </h2>

            {error ? (
              <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            ) : null}

            <form onSubmit={guardarProducto} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="nombre"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Nombre
                </label>
                <input
                  id="nombre"
                  type="text"
                  required
                  value={formulario.nombre}
                  onChange={(event) =>
                    setFormulario({ ...formulario, nombre: event.target.value })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label
                  htmlFor="categoria"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Categoría
                </label>
                <select
                  id="categoria"
                  required
                  value={formulario.categoria}
                  onChange={(event) =>
                    setFormulario({
                      ...formulario,
                      categoria: event.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  {CATEGORIAS_PRODUCTO.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {categoria}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="subcategoria"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Subcategoría
                </label>
                <select
                  id="subcategoria"
                  required
                  value={formulario.subcategoria}
                  onChange={(event) =>
                    setFormulario({
                      ...formulario,
                      subcategoria: event.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  {SUBCATEGORIAS_PRODUCTO.map((subcategoria) => (
                    <option key={subcategoria} value={subcategoria}>
                      {subcategoria}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="precio_kg"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Precio de referencia (por kg)
                </label>
                <p className="mt-1 text-xs text-zinc-500">
                  Referencia del catálogo. Los precios comerciales se gestionan
                  en listas de precios.
                </p>
                <input
                  id="precio_kg"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={formulario.precio_kg}
                  onChange={(event) =>
                    setFormulario({
                      ...formulario,
                      precio_kg: event.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label
                  htmlFor="unidad"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Unidad
                </label>
                <select
                  id="unidad"
                  required
                  value={formulario.unidad}
                  onChange={(event) => {
                    const unidad = event.target.value;
                    setFormulario((prev) => ({
                      ...prev,
                      unidad,
                      tipo_calculo: productoEditando
                        ? prev.tipo_calculo
                        : tipoCalculoPorDefecto(unidad),
                    }));
                  }}
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  {UNIDADES_PRODUCTO.map((unidad) => (
                    <option key={unidad} value={unidad}>
                      {unidad}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="tipo_calculo"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Tipo de cálculo
                </label>
                <select
                  id="tipo_calculo"
                  required
                  value={formulario.tipo_calculo}
                  onChange={(event) =>
                    setFormulario({
                      ...formulario,
                      tipo_calculo: event.target.value as TipoCalculoProducto,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                >
                  {TIPOS_CALCULO.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ETIQUETAS_TIPO_CALCULO[tipo]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-zinc-500">
                  {DESCRIPCION_TIPO_CALCULO[formulario.tipo_calculo]}
                </p>
              </div>

              {productoEditando ? (
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={formulario.activo}
                    onChange={(event) =>
                      setFormulario({
                        ...formulario,
                        activo: event.target.checked,
                      })
                    }
                    className="rounded border-zinc-300"
                  />
                  Producto activo
                </label>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarModal}
                  disabled={guardando}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
