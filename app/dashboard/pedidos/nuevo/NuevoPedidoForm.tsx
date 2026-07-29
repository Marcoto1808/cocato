"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  calcularSubtotalLineaCaptura,
  calcularTotalLineas,
  esPesoTotalEditable,
  formatMoneda,
  mostrarSubtotalLinea,
  normalizarPrecioAplicado,
} from "@/lib/pedido-calculo";
import {
  cargarPreciosLista,
  combinarPreciosConCatalogo,
  precioProductoParaPedido,
  resolverListaPrecioCliente,
  type ListaPrecioResuelta,
  type PreciosListaMap,
} from "@/lib/pedido-lista-precio";
import {
  CATEGORIAS_PRODUCTO,
  type CategoriaProducto,
} from "@/lib/productos";
import {
  esTipoCalculoProducto,
  tipoCalculoPorDefecto,
  type TipoCalculoProducto,
} from "@/lib/tipo-calculo-producto";
import {
  etiquetaCantidadModo,
  type UnidadCapturaPedido,
} from "@/lib/pedido-unidades";
import {
  cantidadNumericaParaCalculo,
  cantidadSolicitadaParaGuardar,
  cantidadTextoParaGuardar,
  esCantidadTexto,
  importeFijoDesdeCantidad,
  lineaTieneCantidadValida,
  mostrarCantidadSolicitada,
  parsearCantidadCaptura,
  type CantidadCapturada,
} from "@/lib/pedido-cantidad";
import CantidadConUnidad from "@/components/pedidos/CantidadConUnidad";
import SelectorModoCaptura from "@/components/pedidos/SelectorModoCaptura";
import {
  evaluarCreditoCliente,
  MENSAJE_CREDITO_EXCEDIDO,
} from "@/lib/cliente-credito";

type TipoClienteJoin = {
  id: string;
  nombre: string;
};

type ClienteOption = {
  id: string;
  nombre_negocio: string;
  propietario: string | null;
  tipo_cliente_id: string;
  lista_precio_id: string | null;
  limite_credito: number;
  tipos_cliente: TipoClienteJoin | TipoClienteJoin[] | null;
  listas_precio: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
};

type ProductoOption = {
  id: string;
  nombre: string;
  unidad: string;
  precio_kg: number;
  tipo_calculo: TipoCalculoProducto;
  categoria: string;
};

type LineaCaptura = {
  key: string;
  producto_id: string;
  nombre: string;
  unidad: string;
  tipo_calculo: TipoCalculoProducto;
  cantidad: number;
  cantidad_texto: string | null;
  precio_lista: number;
  precio_aplicado: number;
  precio_modificado: boolean;
  peso_real: number | null;
  subtotal: number;
};

function resolverJoin<T>(valor: T | T[] | null | undefined): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

function formatearError(error: PostgrestError | null): string {
  if (!error) return "Error desconocido.";
  return [error.message, error.details, error.hint, error.code]
    .filter(Boolean)
    .join(" | ");
}

function crearLineaDesdeProducto(
  producto: ProductoOption,
  precioLista: number,
  parsed: CantidadCapturada,
  unidad: UnidadCapturaPedido
): LineaCaptura {
  const tipo_calculo =
    producto.tipo_calculo ?? tipoCalculoPorDefecto(producto.unidad);

  const cantidad = cantidadSolicitadaParaGuardar(parsed);
  const cantidad_texto = cantidadTextoParaGuardar(parsed);
  const cantidadEsTexto = esCantidadTexto(cantidad_texto);
  const importeFijo =
    parsed.tipo === "importe" ? parsed.importe : importeFijoDesdeCantidad(cantidad_texto);
  const cantidadCalculo = cantidadNumericaParaCalculo(cantidad, cantidad_texto);

  return {
    key: crypto.randomUUID(),
    producto_id: producto.id,
    nombre: producto.nombre,
    unidad,
    tipo_calculo,
    cantidad,
    cantidad_texto,
    precio_lista: precioLista,
    precio_aplicado: precioLista,
    precio_modificado: false,
    peso_real: null,
    subtotal: calcularSubtotalLineaCaptura(
      unidad,
      cantidadCalculo,
      precioLista,
      null,
      cantidadEsTexto,
      importeFijo
    ),
  };
}

function recalcularLinea(linea: LineaCaptura): LineaCaptura {
  const cantidadEsTexto = esCantidadTexto(linea.cantidad_texto);
  const importeFijo = importeFijoDesdeCantidad(linea.cantidad_texto);
  const cantidadCalculo = cantidadNumericaParaCalculo(
    linea.cantidad,
    linea.cantidad_texto
  );

  return {
    ...linea,
    subtotal: calcularSubtotalLineaCaptura(
      linea.unidad,
      cantidadCalculo,
      linea.precio_aplicado,
      linea.peso_real,
      cantidadEsTexto,
      importeFijo
    ),
  };
}

function aplicarCambiosLinea(
  linea: LineaCaptura,
  cambios: Partial<LineaCaptura>
): LineaCaptura {
  const actualizada = { ...linea, ...cambios };

  if ("precio_aplicado" in cambios) {
    actualizada.precio_aplicado = normalizarPrecioAplicado(
      actualizada.precio_aplicado
    );
    actualizada.precio_modificado =
      actualizada.precio_aplicado !== actualizada.precio_lista;
  }

  if ("unidad" in cambios && cambios.unidad === "kg") {
    actualizada.peso_real = null;
  }

  return recalcularLinea(actualizada);
}

export default function NuevoPedidoForm() {
  const router = useRouter();
  const productoInputRef = useRef<HTMLInputElement>(null);
  const cantidadInputRef = useRef<HTMLInputElement>(null);
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [productos, setProductos] = useState<ProductoOption[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [cargandoLista, setCargandoLista] = useState(false);

  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] =
    useState<ClienteOption | null>(null);
  const [listaResuelta, setListaResuelta] = useState<ListaPrecioResuelta | null>(
    null
  );
  const [preciosLista, setPreciosLista] = useState<PreciosListaMap>(new Map());

  const [categoriaCaptura, setCategoriaCaptura] =
    useState<CategoriaProducto>("Cerdo");
  const [productoBusqueda, setProductoBusqueda] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] =
    useState<ProductoOption | null>(null);
  const [cantidadCaptura, setCantidadCaptura] = useState("");
  const [modoCaptura, setModoCaptura] = useState<UnidadCapturaPedido>("kg");
  const [comboboxAbierto, setComboboxAbierto] = useState(false);
  const [lineas, setLineas] = useState<LineaCaptura[]>([]);
  const [observaciones, setObservaciones] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advertenciaCredito, setAdvertenciaCredito] = useState<string | null>(
    null
  );
  const [validandoCredito, setValidandoCredito] = useState(false);

  const cargarCatalogo = useCallback(async () => {
    setCargandoCatalogo(true);
    setError(null);

    const [clientesRes, productosRes] = await Promise.all([
      supabase
        .from("clientes")
        .select(
          "id, nombre_negocio, propietario, tipo_cliente_id, lista_precio_id, limite_credito, tipos_cliente(id, nombre), listas_precio(id, nombre)"
        )
        .eq("activo", true)
        .order("nombre_negocio"),
      supabase
        .from("productos")
        .select("id, nombre, unidad, precio_kg, tipo_calculo, categoria")
        .eq("activo", true)
        .order("nombre"),
    ]);

    if (clientesRes.error || productosRes.error) {
      setError(
        formatearError(clientesRes.error ?? productosRes.error ?? null)
      );
      setCargandoCatalogo(false);
      return;
    }

    setClientes((clientesRes.data ?? []) as ClienteOption[]);
    setProductos(
      ((productosRes.data ?? []) as ProductoOption[]).map((producto) => ({
        ...producto,
        tipo_calculo: esTipoCalculoProducto(producto.tipo_calculo)
          ? producto.tipo_calculo
          : tipoCalculoPorDefecto(producto.unidad),
      }))
    );
    setCargandoCatalogo(false);
  }, []);

  useEffect(() => {
    cargarCatalogo();
  }, [cargarCatalogo]);

  useEffect(() => {
    if (!clienteSeleccionado) {
      setAdvertenciaCredito(null);
      return;
    }

    let cancelado = false;

    void (async () => {
      setValidandoCredito(true);

      try {
        const evaluacion = await evaluarCreditoCliente(
          clienteSeleccionado.id,
          Number(clienteSeleccionado.limite_credito ?? 0)
        );

        if (!cancelado) {
          setAdvertenciaCredito(
            evaluacion.permitido ? null : MENSAJE_CREDITO_EXCEDIDO
          );
        }
      } catch {
        if (!cancelado) {
          setAdvertenciaCredito(null);
        }
      } finally {
        if (!cancelado) {
          setValidandoCredito(false);
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [clienteSeleccionado]);

  const clientesFiltrados = useMemo(() => {
    const termino = busquedaCliente.trim().toLowerCase();
    if (!termino) return clientes;

    return clientes.filter((cliente) => {
      const tipo = resolverJoin(cliente.tipos_cliente);
      const campos = [
        cliente.nombre_negocio,
        cliente.propietario,
        tipo?.nombre,
      ];
      return campos.some((campo) =>
        campo?.toLowerCase().includes(termino)
      );
    });
  }, [clientes, busquedaCliente]);

  const productosDeCategoria = useMemo(
    () =>
      productos.filter(
        (producto) => producto.categoria === categoriaCaptura
      ),
    [productos, categoriaCaptura]
  );

  const productosCombobox = useMemo(() => {
    const termino = productoBusqueda.trim().toLowerCase();
    if (!termino) return productosDeCategoria;

    return productosDeCategoria.filter((producto) =>
      producto.nombre.toLowerCase().includes(termino)
    );
  }, [productosDeCategoria, productoBusqueda]);

  const total = useMemo(() => calcularTotalLineas(lineas), [lineas]);

  function reiniciarCapturaProducto(mantenerCategoria = true) {
    if (!mantenerCategoria) {
      setCategoriaCaptura("Cerdo");
    }
    setProductoBusqueda("");
    setProductoSeleccionado(null);
    setCantidadCaptura("");
    setModoCaptura("kg");
    setComboboxAbierto(false);
    window.requestAnimationFrame(() => productoInputRef.current?.focus());
  }

  function elegirProducto(producto: ProductoOption) {
    setProductoSeleccionado(producto);
    setProductoBusqueda(producto.nombre);
    setComboboxAbierto(false);
    window.requestAnimationFrame(() => cantidadInputRef.current?.focus());
  }

  function cambiarCategoria(categoria: CategoriaProducto) {
    setCategoriaCaptura(categoria);
    setProductoBusqueda("");
    setProductoSeleccionado(null);
    setCantidadCaptura("");
    setModoCaptura("kg");
    setComboboxAbierto(false);
    window.requestAnimationFrame(() => productoInputRef.current?.focus());
  }

  async function seleccionarCliente(cliente: ClienteOption) {
    setClienteSeleccionado(cliente);
    setBusquedaCliente(cliente.nombre_negocio);
    setLineas([]);
    reiniciarCapturaProducto(true);
    setError(null);
    setCargandoLista(true);

    const { lista, error: listaError } = await resolverListaPrecioCliente(
      cliente.tipo_cliente_id,
      cliente.lista_precio_id
    );

    if (listaError) {
      setError(listaError);
    }

    setListaResuelta(lista);

    try {
      const preciosLista = lista
        ? await cargarPreciosLista(lista.id)
        : new Map<string, number>();
      setPreciosLista(combinarPreciosConCatalogo(preciosLista, productos));
    } catch (cargaError) {
      const mensaje =
        cargaError instanceof Error
          ? cargaError.message
          : "Error al cargar la lista de precios.";
      setError(mensaje);
      setPreciosLista(combinarPreciosConCatalogo(new Map(), productos));
    }

    setCargandoLista(false);
  }

  function limpiarCliente() {
    setClienteSeleccionado(null);
    setBusquedaCliente("");
    setListaResuelta(null);
    setPreciosLista(new Map());
    setLineas([]);
    reiniciarCapturaProducto(false);
  }

  function agregarLineaCaptura() {
    let producto = productoSeleccionado;

    if (!producto && productosCombobox.length === 1) {
      producto = productosCombobox[0];
    }

    if (!producto) {
      setError("Selecciona un producto de la lista.");
      return;
    }

    const parsed = parsearCantidadCaptura(cantidadCaptura);
    if (!parsed) {
      setError("Ingresa una cantidad válida.");
      cantidadInputRef.current?.focus();
      return;
    }

    setError(null);

    const precioLista = precioProductoParaPedido(preciosLista, producto);

    const lineaExistente =
      parsed.tipo === "numerica"
        ? lineas.find(
            (linea) =>
              linea.producto_id === producto.id &&
              linea.unidad === modoCaptura &&
              !linea.cantidad_texto
          )
        : undefined;

    if (lineaExistente && parsed.tipo === "numerica") {
      actualizarLinea(lineaExistente.key, {
        cantidad: lineaExistente.cantidad + parsed.cantidad,
        cantidad_texto: null,
      });
    } else {
      setLineas((prev) => [
        ...prev,
        crearLineaDesdeProducto(producto, precioLista, parsed, modoCaptura),
      ]);
    }

    reiniciarCapturaProducto(true);
  }

  function manejarEnterProducto(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();

    if (productoSeleccionado) {
      cantidadInputRef.current?.focus();
      return;
    }

    if (productosCombobox.length === 1) {
      elegirProducto(productosCombobox[0]);
      return;
    }

    const coincidenciaExacta = productosCombobox.find(
      (producto) =>
        producto.nombre.toLowerCase() ===
        productoBusqueda.trim().toLowerCase()
    );

    if (coincidenciaExacta) {
      elegirProducto(coincidenciaExacta);
    }
  }

  function actualizarCantidadLinea(key: string, valor: string) {
    const trimmed = valor.trim();
    if (!trimmed) {
      return;
    }

    const parsed = parsearCantidadCaptura(valor);
    if (!parsed) {
      return;
    }

    if (parsed.tipo === "numerica") {
      actualizarLinea(key, {
        cantidad: parsed.cantidad,
        cantidad_texto: null,
      });
      return;
    }

    actualizarLinea(key, {
      cantidad: 1,
      cantidad_texto: parsed.cantidad_texto,
    });
  }

  function actualizarLinea(key: string, cambios: Partial<LineaCaptura>) {
    setLineas((prev) =>
      prev.map((linea) => {
        if (linea.key !== key) return linea;
        return aplicarCambiosLinea(linea, cambios);
      })
    );
  }

  function eliminarLinea(key: string) {
    setLineas((prev) => prev.filter((linea) => linea.key !== key));
  }

  async function guardarPedido() {
    if (!clienteSeleccionado) {
      setError("Selecciona un cliente.");
      return;
    }

    if (lineas.length === 0) {
      setError("Agrega al menos un producto al pedido.");
      return;
    }

    const lineasInvalidas = lineas.filter(
      (linea) => !lineaTieneCantidadValida(linea.cantidad, linea.cantidad_texto)
    );
    if (lineasInvalidas.length > 0) {
      setError("Todas las líneas deben tener una cantidad válida.");
      return;
    }

    try {
      const evaluacion = await evaluarCreditoCliente(
        clienteSeleccionado.id,
        Number(clienteSeleccionado.limite_credito ?? 0)
      );

      if (!evaluacion.permitido) {
        setError(evaluacion.mensaje ?? MENSAJE_CREDITO_EXCEDIDO);
        return;
      }
    } catch {
      setError("No se pudo validar el crédito del cliente. Intenta de nuevo.");
      return;
    }

    setGuardando(true);
    setError(null);

    const resumenProductos = lineas
      .map(
        (linea) =>
          `${mostrarCantidadSolicitada(linea.cantidad, linea.cantidad_texto, linea.unidad)} ${linea.nombre}`
      )
      .join(", ");

    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos")
      .insert({
        cliente_id: clienteSeleccionado.id,
        tipo_cliente_id: clienteSeleccionado.tipo_cliente_id,
        lista_precio_id: listaResuelta?.id ?? null,
        estado: "Pendiente",
        fecha: new Date().toISOString(),
        mensaje_original: `Pedido manual — ${resumenProductos}`,
        observaciones: observaciones.trim() || null,
        total,
      })
      .select("id")
      .single();

    if (pedidoError || !pedido) {
      setError(`No se pudo crear el pedido. ${formatearError(pedidoError)}`);
      setGuardando(false);
      return;
    }

    const detallePayload = lineas.map((linea) => ({
      pedido_id: pedido.id,
      producto_id: linea.producto_id,
      cantidad_solicitada: linea.cantidad,
      cantidad_texto: linea.cantidad_texto,
      unidad: linea.unidad,
      tipo_calculo: linea.tipo_calculo,
      peso_real: linea.peso_real,
      precio_lista: linea.precio_lista,
      precio_aplicado: linea.precio_aplicado,
      precio_modificado: linea.precio_modificado,
      subtotal: linea.subtotal,
    }));

    const { error: detalleError } = await supabase
      .from("detalle_pedido")
      .insert(detallePayload);

    if (detalleError) {
      await supabase.from("pedidos").delete().eq("id", pedido.id);
      setError(`No se pudo guardar el detalle. ${formatearError(detalleError)}`);
      setGuardando(false);
      return;
    }

    router.push(`/dashboard/pedidos/${pedido.id}?creado=1`);
    router.refresh();
  }

  const tipoClienteNombre =
    resolverJoin(clienteSeleccionado?.tipos_cliente ?? null)?.nombre ?? "—";

  if (cargandoCatalogo) {
    return (
      <div className="rounded-xl bg-white p-8 text-center text-zinc-500 shadow-sm ring-1 ring-zinc-200">
        Cargando catálogo...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {error ? (
        <div className="rounded-xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        <h2 className="text-lg font-semibold text-zinc-900">Cliente</h2>

        {!clienteSeleccionado ? (
          <div className="mt-4 space-y-3">
            <input
              type="text"
              value={busquedaCliente}
              onChange={(event) => setBusquedaCliente(event.target.value)}
              placeholder="Buscar por negocio, dueño o tipo..."
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              autoFocus
            />

            <select
              value=""
              onChange={(event) => {
                const id = event.target.value;
                if (!id) return;
                const cliente = clientes.find((item) => item.id === id);
                if (cliente) seleccionarCliente(cliente);
              }}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            >
              <option value="">
                {clientesFiltrados.length === 0
                  ? "No hay clientes que coincidan"
                  : "Seleccionar de la lista..."}
              </option>
              {clientesFiltrados.map((cliente) => {
                const tipo = resolverJoin(cliente.tipos_cliente);
                return (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nombre_negocio}
                    {cliente.propietario?.trim()
                      ? ` · ${cliente.propietario.trim()}`
                      : ""}
                    {tipo ? ` · ${tipo.nombre}` : ""}
                  </option>
                );
              })}
            </select>

            {busquedaCliente.trim() && clientesFiltrados.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No se encontraron clientes activos con ese criterio.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-zinc-900">
                  {clienteSeleccionado.nombre_negocio}
                </p>
                {clienteSeleccionado.propietario?.trim() ? (
                  <p className="text-sm text-zinc-600">
                    {clienteSeleccionado.propietario.trim()}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={limpiarCliente}
                className="shrink-0 text-sm font-medium text-zinc-600 hover:text-zinc-900"
              >
                Cambiar
              </button>
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Tipo de cliente
                </dt>
                <dd className="mt-1 text-sm font-medium text-zinc-900">
                  {tipoClienteNombre}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Lista de precios
                </dt>
                <dd className="mt-1 text-sm font-medium text-zinc-900">
                  {cargandoLista
                    ? "Cargando..."
                    : listaResuelta
                      ? `${listaResuelta.nombre}${listaResuelta.esOverride ? " (asignada al cliente)" : " (vigente)"}`
                      : "Sin lista vigente — publica un Balance"}
                </dd>
              </div>
            </dl>

            {validandoCredito ? (
              <p className="mt-4 text-sm text-zinc-500">
                Validando crédito del cliente...
              </p>
            ) : null}

            {advertenciaCredito ? (
              <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {advertenciaCredito}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section
        className={`rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 ${!clienteSeleccionado ? "opacity-50" : ""}`}
      >
        <h2 className="text-lg font-semibold text-zinc-900">Productos</h2>

        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">Categoría</p>
            <div className="flex gap-2">
              {CATEGORIAS_PRODUCTO.map((categoria) => (
                <button
                  key={categoria}
                  type="button"
                  onClick={() => cambiarCategoria(categoria)}
                  disabled={!clienteSeleccionado || cargandoLista}
                  className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    categoriaCaptura === categoria
                      ? categoria === "Cerdo"
                        ? "bg-pink-600 text-white"
                        : "bg-red-700 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {categoria}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="producto-combobox"
              className="mb-2 block text-sm font-medium text-zinc-700"
            >
              Producto
            </label>
            <div className="relative">
              <input
                id="producto-combobox"
                ref={productoInputRef}
                type="text"
                value={productoBusqueda}
                onChange={(event) => {
                  setProductoBusqueda(event.target.value);
                  setProductoSeleccionado(null);
                  setComboboxAbierto(true);
                }}
                onFocus={() => setComboboxAbierto(true)}
                onBlur={() => {
                  window.setTimeout(() => setComboboxAbierto(false), 150);
                }}
                onKeyDown={manejarEnterProducto}
                placeholder={
                  clienteSeleccionado
                    ? `Buscar en ${categoriaCaptura}...`
                    : "Selecciona un cliente primero"
                }
                disabled={!clienteSeleccionado || cargandoLista}
                autoComplete="off"
                className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400"
              />

              {comboboxAbierto &&
              clienteSeleccionado &&
              productosCombobox.length > 0 ? (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                  {productosCombobox.map((producto) => {
                    const precio = precioProductoParaPedido(
                      preciosLista,
                      producto
                    );
                    return (
                      <li key={producto.id}>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => elegirProducto(producto)}
                          className="flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left hover:bg-zinc-50"
                        >
                          <span className="font-medium text-zinc-900">
                            {producto.nombre}
                          </span>
                          <span className="shrink-0 text-sm text-zinc-500">
                            {formatMoneda(precio)} · {producto.unidad}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {comboboxAbierto &&
              clienteSeleccionado &&
              productoBusqueda.trim() &&
              productosCombobox.length === 0 ? (
                <p className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500 shadow-lg">
                  No hay productos en {categoriaCaptura} con ese criterio.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700">Captura</p>
              <SelectorModoCaptura
                value={modoCaptura}
                onChange={setModoCaptura}
                disabled={!productoSeleccionado}
              />
            </div>

            <div className="min-w-[140px] flex-1">
              <label
                htmlFor="cantidad-captura"
                className="mb-2 block text-sm font-medium text-zinc-700"
              >
                {productoSeleccionado
                  ? etiquetaCantidadModo(modoCaptura)
                  : "Cantidad"}
              </label>
              <input
                id="cantidad-captura"
                ref={cantidadInputRef}
                type="text"
                value={cantidadCaptura}
                onChange={(event) => setCantidadCaptura(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    agregarLineaCaptura();
                  }
                }}
                disabled={!productoSeleccionado}
                placeholder={
                  productoSeleccionado
                    ? modoCaptura === "kg"
                      ? "Ej. 18, medio kilo, 1/4 kg"
                      : "Ej. 5, 2 piezas"
                    : "Elige un producto"
                }
                className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400"
              />
            </div>

            <button
              type="button"
              onClick={agregarLineaCaptura}
              disabled={!clienteSeleccionado || !productoSeleccionado}
              className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Agregar
            </button>
          </div>
        </div>

        {lineas.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
            {clienteSeleccionado
              ? "Elige categoría, producto y cantidad para agregar al pedido."
              : "La captura de productos se habilita al elegir un cliente."}
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <th className="pb-3 pr-3">Producto</th>
                  <th className="pb-3 pr-3">Cantidad</th>
                  <th className="pb-3 pr-3">Precio de lista</th>
                  <th className="pb-3 pr-3">Precio aplicado</th>
                  <th className="pb-3 pr-3">Peso total (kg)</th>
                  <th className="pb-3 pr-3">Subtotal</th>
                  <th className="pb-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((linea) => {
                  const cantidadEsTexto = esCantidadTexto(linea.cantidad_texto);
                  const importeFijo = importeFijoDesdeCantidad(linea.cantidad_texto);
                  const subtotalTexto = mostrarSubtotalLinea(
                    linea.unidad,
                    linea.subtotal,
                    linea.peso_real,
                    cantidadEsTexto,
                    importeFijo
                  );

                  return (
                  <tr key={linea.key} className="border-b border-zinc-100">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-zinc-900">{linea.nombre}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <CantidadConUnidad
                        cantidad={linea.cantidad}
                        cantidadTexto={linea.cantidad_texto}
                        unidad={linea.unidad}
                        onCantidadChange={(valor) =>
                          actualizarCantidadLinea(linea.key, valor)
                        }
                        onUnidadChange={(unidad) =>
                          actualizarLinea(linea.key, { unidad })
                        }
                      />
                    </td>
                    <td className="py-3 pr-3 text-sm text-zinc-600">
                      {formatMoneda(linea.precio_lista)}
                    </td>
                    <td className="py-3 pr-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={linea.precio_aplicado}
                        onChange={(event) =>
                          actualizarLinea(linea.key, {
                            precio_aplicado: normalizarPrecioAplicado(
                              Number(event.target.value)
                            ),
                          })
                        }
                        className={`w-28 rounded-lg border px-2 py-1.5 text-sm text-zinc-900 ${
                          linea.precio_modificado
                            ? "border-amber-300 bg-amber-50"
                            : "border-zinc-300"
                        }`}
                      />
                    </td>
                    <td className="py-3 pr-3">
                      {esPesoTotalEditable(linea.unidad) ? (
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="kg"
                          value={linea.peso_real ?? ""}
                          onChange={(event) => {
                            const valor = event.target.value;
                            actualizarLinea(linea.key, {
                              peso_real:
                                valor === "" ? null : Number(valor),
                            });
                          }}
                          className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900"
                        />
                      ) : (
                        <span className="text-sm text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-sm font-medium text-zinc-900">
                      {subtotalTexto ? (
                        subtotalTexto
                      ) : (
                        <span className="text-zinc-400">Pendiente</span>
                      )}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => eliminarLinea(linea.key)}
                        className="text-sm font-medium text-red-600 hover:text-red-800"
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        <label
          htmlFor="observaciones"
          className="block text-sm font-medium text-zinc-700"
        >
          Observaciones
          <span className="ml-1 font-normal text-zinc-400">(opcional)</span>
        </label>
        <textarea
          id="observaciones"
          rows={2}
          value={observaciones}
          onChange={(event) => setObservaciones(event.target.value)}
          placeholder="Instrucciones de entrega, corte especial, etc."
          className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </section>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-zinc-900 px-6 py-4 text-white shadow-lg">
        <div>
          <p className="text-sm text-zinc-300">Total del pedido</p>
          <p className="text-3xl font-bold">{formatMoneda(total)}</p>
          <p className="text-xs text-zinc-400">
            {lineas.length} producto{lineas.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={guardarPedido}
          disabled={
            guardando ||
            !clienteSeleccionado ||
            lineas.length === 0 ||
            cargandoLista ||
            validandoCredito ||
            Boolean(advertenciaCredito)
          }
          className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar pedido"}
        </button>
      </div>
    </div>
  );
}
