"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  DESCRIPCION_TIPO_CALCULO,
  ETIQUETAS_TIPO_CALCULO,
  TIPOS_CALCULO,
  esTipoCalculoProducto,
  tipoCalculoPorDefecto,
  type TipoCalculoProducto,
} from "@/lib/tipo-calculo-producto";
import ProductosTable, { type Producto } from "@/components/productos/ProductosTable";
import VolverAlDashboardLink from "@/components/navegacion/VolverAlDashboardLink";

// Deben coincidir con los CHECK constraints de public.productos.
const CATEGORIAS = ["Res", "Cerdo"] as const;
const SUBCATEGORIAS = [
  "Corte",
  "Embutido",
  "Vísceras",
  "Huesos",
  "Grasa",
  "Obrador",
] as const;
const UNIDADES = ["kg", "pieza", "paquete", "caja"] as const;

const COLUMNAS_PRODUCTO =
  "id, nombre, precio_kg, unidad, categoria, subcategoria, tipo_calculo, activo";

const COLUMNAS_PRODUCTO_SIN_TIPO_CALCULO =
  "id, nombre, precio_kg, unidad, categoria, subcategoria, activo";

type ProductoDb = Omit<Producto, "tipo_calculo"> & {
  tipo_calculo?: TipoCalculoProducto | null;
};

function esColumnaInexistente(error: PostgrestError | null): boolean {
  return error?.code === "42703";
}

function normalizarProducto(producto: ProductoDb): Producto {
  return {
    ...producto,
    tipo_calculo:
      producto.tipo_calculo && esTipoCalculoProducto(producto.tipo_calculo)
        ? producto.tipo_calculo
        : tipoCalculoPorDefecto(producto.unidad),
  };
}

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

function formatearErrorSupabase(error: PostgrestError | null): string {
  if (!error) {
    return "Sin respuesta de Supabase.";
  }

  return [
    error.message,
    error.details ? `Detalle: ${error.details}` : null,
    error.hint ? `Hint: ${error.hint}` : null,
    error.code ? `Código: ${error.code}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(
    null
  );
  const [formulario, setFormulario] =
    useState<FormularioProducto>(FORMULARIO_VACIO);

  useEffect(() => {
    cargarProductos();
  }, []);

  async function cargarProductos() {
    setCargando(true);
    setError(null);

    let { data, error: queryError } = await supabase
      .from("productos")
      .select(COLUMNAS_PRODUCTO)
      .order("nombre", { ascending: true });

    if (esColumnaInexistente(queryError)) {
      const fallback = await supabase
        .from("productos")
        .select(COLUMNAS_PRODUCTO_SIN_TIPO_CALCULO)
        .order("nombre", { ascending: true });

      data = fallback.data;
      queryError = fallback.error;
    }

    if (queryError) {
      console.error("[productos] select error:", queryError);
      setError(
        `No se pudieron cargar los productos. ${formatearErrorSupabase(queryError)}`
      );
      setCargando(false);
      return;
    }

    setProductos(((data ?? []) as ProductoDb[]).map(normalizarProducto));
    setCargando(false);
  }

  function abrirModalNuevo() {
    setProductoEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setError(null);
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
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setProductoEditando(null);
    setFormulario(FORMULARIO_VACIO);
  }

  async function guardarProducto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      return;
    }

    setGuardando(true);
    setError(null);

    const payloadBase = {
      nombre,
      precio_kg: precio,
      unidad,
      categoria,
      subcategoria,
      activo: formulario.activo,
    };

    console.log("[productos] save payload:", {
      ...payloadBase,
      tipo_calculo,
    });

    async function guardar(payloadActual: Record<string, unknown>) {
      return productoEditando
        ? await supabase
            .from("productos")
            .update(payloadActual)
            .eq("id", productoEditando.id)
        : await supabase.from("productos").insert(payloadActual);
    }

    let { error: saveError } = await guardar({
      ...payloadBase,
      tipo_calculo,
    });

    if (esColumnaInexistente(saveError)) {
      ({ error: saveError } = await guardar(payloadBase));
    }

    if (saveError) {
      console.error("[productos] save error.code:", saveError.code);
      console.error("[productos] save error.message:", saveError.message);
      console.error("[productos] save error.details:", saveError.details);
      console.error("[productos] save error.hint:", saveError.hint);
      setError(
        `No se pudo guardar el producto. ${formatearErrorSupabase(saveError)}`
      );
      setGuardando(false);
      return;
    }

    cerrarModal();
    setGuardando(false);
    await cargarProductos();
  }

  async function toggleActivo(producto: Producto) {
    setError(null);

    const { error: updateError } = await supabase
      .from("productos")
      .update({ activo: !producto.activo })
      .eq("id", producto.id);

    if (updateError) {
      console.error("[productos] toggle error:", updateError);
      setError(
        `No se pudo actualizar el estado del producto. ${formatearErrorSupabase(updateError)}`
      );
      return;
    }

    await cargarProductos();
  }

  const productosFiltrados = useMemo(() => {
    return productos
      .filter((producto) => {
        const coincideNombre = producto.nombre
          .toLowerCase()
          .includes(busqueda.toLowerCase());
        const coincideCategoria =
          categoriaFiltro === "Todas" ||
          producto.categoria.toLowerCase() === categoriaFiltro.toLowerCase();

        return coincideNombre && coincideCategoria;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [productos, busqueda, categoriaFiltro]);

  const totalActivos = productos.filter((producto) => producto.activo).length;
  const totalInactivos = productos.length - totalActivos;

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
          <p className="mt-2 text-3xl font-bold text-zinc-900">
            {productos.length}
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Activos</p>
          <p className="mt-2 text-3xl font-bold text-emerald-600">
            {totalActivos}
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-500">Inactivos</p>
          <p className="mt-2 text-3xl font-bold text-zinc-600">
            {totalInactivos}
          </p>
        </div>
      </div>

      {error && !modalAbierto && (
        <div className="mb-6 rounded-xl bg-red-50 px-5 py-4 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

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
          {CATEGORIAS.map((categoria) => (
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
          productos={productosFiltrados}
          onEditar={abrirModalEditar}
          onToggleActivo={toggleActivo}
          sinResultados={productos.length > 0 && productosFiltrados.length === 0}
        />
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg ring-1 ring-zinc-200">
            <h2 className="text-xl font-bold text-zinc-900">
              {productoEditando ? "Editar producto" : "Nuevo producto"}
            </h2>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}

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
                  {CATEGORIAS.map((categoria) => (
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
                  {SUBCATEGORIAS.map((subcategoria) => (
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
                  Precio por kilogramo
                </label>
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
                  {UNIDADES.map((unidad) => (
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

              {productoEditando && (
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
              )}

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
