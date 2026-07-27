"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ProductosTable, { type Producto } from "@/components/productos/ProductosTable";

const CATEGORIAS = ["Res", "Cerdo", "Pollo", "Otros"] as const;

type FormularioProducto = {
  nombre: string;
  precio_kg: string;
  unidad: string;
  categoria: string;
  activo: boolean;
};

const FORMULARIO_VACIO: FormularioProducto = {
  nombre: "",
  precio_kg: "",
  unidad: "kg",
  categoria: "Res",
  activo: true,
};

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

    const { data, error: queryError } = await supabase
      .from("productos")
      .select("id, nombre, precio_kg, unidad, categoria, activo")
      .order("nombre", { ascending: true });

    if (queryError) {
      setError("No se pudieron cargar los productos.");
      setCargando(false);
      return;
    }

    setProductos((data ?? []) as Producto[]);
    setCargando(false);
  }

  function abrirModalNuevo() {
    setProductoEditando(null);
    setFormulario(FORMULARIO_VACIO);
    setModalAbierto(true);
  }

  function abrirModalEditar(producto: Producto) {
    setProductoEditando(producto);
    setFormulario({
      nombre: producto.nombre,
      precio_kg: String(producto.precio_kg),
      unidad: producto.unidad,
      categoria: producto.categoria,
      activo: producto.activo,
    });
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

    if (
      !nombre ||
      !unidad ||
      !categoria ||
      Number.isNaN(precio) ||
      precio < 0
    ) {
      setError("Completa nombre, categoría, precio válido y unidad.");
      return;
    }

    setGuardando(true);
    setError(null);

    const payload = {
      nombre,
      precio_kg: precio,
      unidad,
      categoria,
      activo: formulario.activo,
    };

    const { error: saveError } = productoEditando
      ? await supabase
          .from("productos")
          .update(payload)
          .eq("id", productoEditando.id)
      : await supabase.from("productos").insert(payload);

    if (saveError) {
      setError("No se pudo guardar el producto.");
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
      setError("No se pudo actualizar el estado del producto.");
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
      <Link
        href="/dashboard"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Volver al Dashboard
      </Link>

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

      {error && (
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
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg ring-1 ring-zinc-200">
            <h2 className="text-xl font-bold text-zinc-900">
              {productoEditando ? "Editar producto" : "Nuevo producto"}
            </h2>

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
                <input
                  id="unidad"
                  type="text"
                  required
                  value={formulario.unidad}
                  onChange={(event) =>
                    setFormulario({ ...formulario, unidad: event.target.value })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
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
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
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
