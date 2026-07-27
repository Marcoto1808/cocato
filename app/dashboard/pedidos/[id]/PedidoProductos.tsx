"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  calcularSubtotalLinea,
  calcularTotalPedido,
  formatMoneda,
  precioKgLinea,
  resolverProductoPedido,
  type LineaPedido,
} from "@/lib/pedido-productos";

type ProductoCatalogo = {
  id: string;
  nombre: string;
  precio_kg: number;
  unidad: string;
  categoria: string;
  subcategoria: string;
};

type Props = {
  pedidoId: string;
  lineasIniciales: LineaPedido[];
};

function normalizarLinea(linea: LineaPedido): LineaPedido {
  return {
    ...linea,
    cantidad_solicitada: Number(linea.cantidad_solicitada),
    peso_real:
      linea.peso_real === null || linea.peso_real === undefined
        ? null
        : Number(linea.peso_real),
    precio_kg: Number(linea.precio_kg),
    subtotal: Number(linea.subtotal),
  };
}

export default function PedidoProductos({
  pedidoId,
  lineasIniciales,
}: Props) {
  const router = useRouter();
  const [lineas, setLineas] = useState(() =>
    lineasIniciales.map(normalizarLinea)
  );
  const [modalAbierto, setModalAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [catalogo, setCatalogo] = useState<ProductoCatalogo[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] =
    useState<ProductoCatalogo | null>(null);
  const [cantidadNueva, setCantidadNueva] = useState("1");
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => calcularTotalPedido(lineas), [lineas]);

  const idsEnPedido = useMemo(
    () => new Set(lineas.map((linea) => linea.producto_id)),
    [lineas]
  );

  const catalogoFiltrado = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return catalogo.filter((producto) => {
      if (idsEnPedido.has(producto.id)) return false;
      if (!termino) return true;

      return (
        producto.nombre.toLowerCase().includes(termino) ||
        producto.categoria.toLowerCase().includes(termino) ||
        producto.subcategoria.toLowerCase().includes(termino)
      );
    });
  }, [busqueda, catalogo, idsEnPedido]);

  async function sincronizarTotalPedido(nuevasLineas: LineaPedido[]) {
    const nuevoTotal = calcularTotalPedido(nuevasLineas);

    await supabase
      .from("pedidos")
      .update({ total: nuevoTotal })
      .eq("id", pedidoId);
  }

  async function abrirModalAgregar() {
    setError(null);
    setBusqueda("");
    setProductoSeleccionado(null);
    setCantidadNueva("1");
    setModalAbierto(true);

    if (catalogo.length > 0) return;

    setCargandoCatalogo(true);

    const { data, error: queryError } = await supabase
      .from("productos")
      .select("id, nombre, precio_kg, unidad, categoria, subcategoria")
      .eq("activo", true)
      .order("orden", { ascending: true });

    if (queryError) {
      setError("No se pudo cargar el catálogo de productos.");
      setCargandoCatalogo(false);
      return;
    }

    setCatalogo((data ?? []) as ProductoCatalogo[]);
    setCargandoCatalogo(false);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setProductoSeleccionado(null);
    setBusqueda("");
    setCantidadNueva("1");
  }

  async function agregarProducto() {
    if (!productoSeleccionado) return;

    const cantidad = Number(cantidadNueva.replace(",", "."));

    if (Number.isNaN(cantidad) || cantidad <= 0) {
      setError("Ingresa una cantidad válida.");
      return;
    }

    setGuardando("agregar");
    setError(null);

    const precioKg = productoSeleccionado.precio_kg;
    const subtotal = calcularSubtotalLinea(
      null,
      cantidad,
      productoSeleccionado.unidad,
      precioKg
    );

    const { data, error: insertError } = await supabase
      .from("detalle_pedido")
      .insert({
        pedido_id: pedidoId,
        producto_id: productoSeleccionado.id,
        cantidad_solicitada: cantidad,
        unidad: productoSeleccionado.unidad,
        precio_kg: precioKg,
        subtotal,
      })
      .select(
        "id, producto_id, cantidad_solicitada, unidad, peso_real, precio_kg, subtotal, productos(nombre, precio_kg, unidad)"
      )
      .single();

    if (insertError || !data) {
      setError("No se pudo agregar el producto al pedido.");
      setGuardando(null);
      return;
    }

    const nuevaLinea = normalizarLinea(data as unknown as LineaPedido);
    const nuevasLineas = [...lineas, nuevaLinea];

    setLineas(nuevasLineas);
    await sincronizarTotalPedido(nuevasLineas);
    setGuardando(null);
    cerrarModal();
    router.refresh();
  }

  async function actualizarPesoReal(linea: LineaPedido, valor: string) {
    const pesoReal = valor.trim() === "" ? null : Number(valor.replace(",", "."));

    if (valor.trim() !== "" && (Number.isNaN(pesoReal) || pesoReal! < 0)) {
      return;
    }

    const precioKg = precioKgLinea(linea);
    const subtotal = calcularSubtotalLinea(
      pesoReal,
      linea.cantidad_solicitada,
      linea.unidad,
      precioKg
    );

    setLineas((prev) =>
      prev.map((item) =>
        item.id === linea.id
          ? { ...item, peso_real: pesoReal, subtotal }
          : item
      )
    );
  }

  async function guardarPesoReal(linea: LineaPedido) {
    const precioKg = precioKgLinea(linea);
    const subtotal = calcularSubtotalLinea(
      linea.peso_real,
      linea.cantidad_solicitada,
      linea.unidad,
      precioKg
    );

    setGuardando(linea.id);
    setError(null);

    const { error: updateError } = await supabase
      .from("detalle_pedido")
      .update({
        peso_real: linea.peso_real,
        precio_kg: precioKg,
        subtotal,
      })
      .eq("id", linea.id);

    if (updateError) {
      setError("No se pudo guardar el peso real.");
      setGuardando(null);
      return;
    }

    const nuevasLineas = lineas.map((item) =>
      item.id === linea.id ? { ...item, subtotal, precio_kg: precioKg } : item
    );

    setLineas(nuevasLineas);
    await sincronizarTotalPedido(nuevasLineas);
    setGuardando(null);
    router.refresh();
  }

  async function eliminarLinea(linea: LineaPedido) {
    setGuardando(linea.id);
    setError(null);

    const { error: deleteError } = await supabase
      .from("detalle_pedido")
      .delete()
      .eq("id", linea.id);

    if (deleteError) {
      setError("No se pudo eliminar el producto.");
      setGuardando(null);
      return;
    }

    const nuevasLineas = lineas.filter((item) => item.id !== linea.id);

    setLineas(nuevasLineas);
    await sincronizarTotalPedido(nuevasLineas);
    setGuardando(null);
    router.refresh();
  }

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
          Productos del pedido
        </h2>

        {lineas.length > 0 && (
          <button
            type="button"
            onClick={abrirModalAgregar}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            + Agregar producto
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {lineas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center">
          <p className="text-zinc-600">
            Este pedido aún no tiene productos asociados.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Agrégalos manualmente o, más adelante, desde el mensaje original
            con IA.
          </p>
          <button
            type="button"
            onClick={abrirModalAgregar}
            className="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            Agregar producto
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {lineas.map((linea) => {
            const producto = resolverProductoPedido(linea.productos);
            const precioKg = precioKgLinea(linea);
            const subtotal = calcularSubtotalLinea(
              linea.peso_real,
              linea.cantidad_solicitada,
              linea.unidad,
              precioKg
            );
            const procesando = guardando === linea.id;

            return (
              <div
                key={linea.id}
                className="rounded-lg border border-zinc-100 bg-zinc-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900">
                      {producto?.nombre ?? "Producto"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Solicitado: {linea.cantidad_solicitada} {linea.unidad}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => eliminarLinea(linea)}
                    disabled={guardando !== null}
                    className="text-sm text-zinc-400 transition hover:text-red-600 disabled:opacity-50"
                    aria-label="Eliminar producto"
                  >
                    Eliminar
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Unidad
                    </label>
                    <p className="mt-1 text-sm text-zinc-800">{linea.unidad}</p>
                  </div>

                  <div>
                    <label
                      htmlFor={`peso-${linea.id}`}
                      className="block text-xs font-medium uppercase tracking-wide text-zinc-400"
                    >
                      Peso real (kg)
                    </label>
                    <input
                      id={`peso-${linea.id}`}
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="0.000"
                      value={linea.peso_real ?? ""}
                      onChange={(event) =>
                        actualizarPesoReal(linea, event.target.value)
                      }
                      onBlur={() => guardarPesoReal(linea)}
                      disabled={procesando}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Precio / kg
                    </label>
                    <p className="mt-1 text-sm font-medium text-zinc-800">
                      {formatMoneda(precioKg)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                      Subtotal
                    </label>
                    <p className="mt-1 text-sm font-semibold text-zinc-900">
                      {formatMoneda(subtotal)}
                    </p>
                  </div>
                </div>

                {procesando && (
                  <p className="mt-2 text-xs text-zinc-500">Guardando...</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 border-t border-zinc-100 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            Total del pedido
          </span>
          <span className="text-2xl font-bold text-zinc-900">
            {formatMoneda(total)}
          </span>
        </div>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-lg ring-1 ring-zinc-200">
            <div className="border-b border-zinc-100 px-6 py-4">
              <h3 className="text-lg font-bold text-zinc-900">
                Agregar producto
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                Busca en el catálogo maestro
              </p>
            </div>

            <div className="overflow-y-auto px-6 py-4">
              {!productoSeleccionado ? (
                <>
                  <input
                    type="text"
                    placeholder="Buscar por nombre, categoría..."
                    value={busqueda}
                    onChange={(event) => setBusqueda(event.target.value)}
                    className="mb-4 w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    autoFocus
                  />

                  {cargandoCatalogo ? (
                    <p className="py-8 text-center text-sm text-zinc-500">
                      Cargando catálogo...
                    </p>
                  ) : catalogoFiltrado.length === 0 ? (
                    <p className="py-8 text-center text-sm text-zinc-500">
                      No se encontraron productos.
                    </p>
                  ) : (
                    <ul className="max-h-72 space-y-2 overflow-y-auto">
                      {catalogoFiltrado.slice(0, 50).map((producto) => (
                        <li key={producto.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setProductoSeleccionado(producto);
                              setCantidadNueva(
                                producto.unidad === "kg" ? "1" : "1"
                              );
                            }}
                            className="w-full rounded-lg border border-zinc-200 px-4 py-3 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
                          >
                            <span className="font-medium text-zinc-900">
                              {producto.nombre}
                            </span>
                            <span className="mt-1 block text-sm text-zinc-500">
                              {producto.categoria} · {producto.subcategoria} ·{" "}
                              {formatMoneda(producto.precio_kg)}/kg
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-zinc-50 px-4 py-3">
                    <p className="font-medium text-zinc-900">
                      {productoSeleccionado.nombre}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Unidad: {productoSeleccionado.unidad} ·{" "}
                      {formatMoneda(productoSeleccionado.precio_kg)}/kg
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="cantidad-nueva"
                      className="block text-sm font-medium text-zinc-700"
                    >
                      Cantidad solicitada
                    </label>
                    <input
                      id="cantidad-nueva"
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={cantidadNueva}
                      onChange={(event) => setCantidadNueva(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setProductoSeleccionado(null)}
                    className="text-sm text-zinc-500 hover:text-zinc-800"
                  >
                    ← Elegir otro producto
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-zinc-100 px-6 py-4">
              <button
                type="button"
                onClick={cerrarModal}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
              {productoSeleccionado && (
                <button
                  type="button"
                  onClick={agregarProducto}
                  disabled={guardando === "agregar"}
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {guardando === "agregar" ? "Agregando..." : "Agregar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
