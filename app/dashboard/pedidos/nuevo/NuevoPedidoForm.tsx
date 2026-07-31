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
import {
  ETIQUETA_CLIENTE_TEMPORAL,
  NOMBRE_CLIENTE_SISTEMA,
} from "@/lib/pedido-rapido";
import { crearPedido } from "@/lib/pedidos/pedido-service";

type ModoInicioPedido = "seleccion" | "registrado" | "rapido";

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

  const [modoInicio, setModoInicio] = useState<ModoInicioPedido>("seleccion");
  const [pedidoRapidoActivo, setPedidoRapidoActivo] = useState(false);
  const [clienteSistema, setClienteSistema] = useState<ClienteOption | null>(
    null
  );
  const [nombreRapido, setNombreRapido] = useState("");

  const cargarCatalogo = useCallback(async () => {
    setCargandoCatalogo(true);
    setError(null);

    const [clientesRes, productosRes, sistemaRes] = await Promise.all([
      supabase
        .from("clientes")
        .select(
          "id, nombre_negocio, propietario, tipo_cliente_id, lista_precio_id, limite_credito, tipos_cliente(id, nombre), listas_precio(id, nombre)"
        )
        .eq("activo", true)
        .neq("nombre_negocio", NOMBRE_CLIENTE_SISTEMA)
        .order("nombre_negocio"),
      supabase
        .from("productos")
        .select("id, nombre, unidad, precio_kg, tipo_calculo, categoria")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("clientes")
        .select(
          "id, nombre_negocio, propietario, tipo_cliente_id, lista_precio_id, limite_credito, tipos_cliente(id, nombre), listas_precio(id, nombre)"
        )
        .eq("nombre_negocio", NOMBRE_CLIENTE_SISTEMA)
        .maybeSingle(),
    ]);

    if (clientesRes.error || productosRes.error || sistemaRes.error) {
      setError(
        formatearError(
          clientesRes.error ?? productosRes.error ?? sistemaRes.error ?? null
        )
      );
      setCargandoCatalogo(false);
      return;
    }

    setClientes((clientesRes.data ?? []) as ClienteOption[]);
    setClienteSistema((sistemaRes.data as ClienteOption | null) ?? null);
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
    if (!clienteSeleccionado || pedidoRapidoActivo) {
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
  }, [clienteSeleccionado, pedidoRapidoActivo]);

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

  const sugerenciasRapido = useMemo(() => {
    const termino = nombreRapido.trim().toLowerCase();
    if (termino.length < 2) return [];

    return clientes
      .filter((cliente) => {
        const campos = [cliente.nombre_negocio, cliente.propietario];
        return campos.some((campo) =>
          campo?.toLowerCase().includes(termino)
        );
      })
      .slice(0, 5);
  }, [clientes, nombreRapido]);

  const clienteListo = Boolean(clienteSeleccionado);
  const nombreClienteMostrar = pedidoRapidoActivo
    ? nombreRapido.trim()
    : (clienteSeleccionado?.nombre_negocio ?? "");

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

  async function cargarListaPreciosCliente(cliente: ClienteOption) {
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

  async function seleccionarCliente(cliente: ClienteOption) {
    setPedidoRapidoActivo(false);
    setModoInicio("registrado");
    setClienteSeleccionado(cliente);
    setBusquedaCliente(cliente.nombre_negocio);
    setLineas([]);
    reiniciarCapturaProducto(true);
    setError(null);
    await cargarListaPreciosCliente(cliente);
  }

  async function continuarPedidoRapido() {
    const nombre = nombreRapido.trim();
    if (!nombre) {
      setError("Escribe el nombre del cliente o negocio.");
      return;
    }

    if (!clienteSistema) {
      setError(
        "Pedido rápido no está configurado. Ejecuta sql/add_pedido_rapido.sql en Supabase."
      );
      return;
    }

    setError(null);
    setPedidoRapidoActivo(true);
    setClienteSeleccionado(clienteSistema);
    setLineas([]);
    reiniciarCapturaProducto(true);
    await cargarListaPreciosCliente(clienteSistema);
  }

  function elegirClienteDesdeSugerencia(cliente: ClienteOption) {
    setNombreRapido("");
    void seleccionarCliente(cliente);
  }

  function limpiarCliente() {
    const eraRapido = pedidoRapidoActivo;

    setClienteSeleccionado(null);
    setPedidoRapidoActivo(false);
    setModoInicio(eraRapido ? "seleccion" : "registrado");
    setBusquedaCliente("");
    setNombreRapido("");
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

    if (pedidoRapidoActivo && !nombreRapido.trim()) {
      setError("Escribe el nombre del cliente o negocio.");
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

    if (!pedidoRapidoActivo) {
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
    }

    setGuardando(true);
    setError(null);

    const resumenProductos = lineas
      .map(
        (linea) =>
          `${mostrarCantidadSolicitada(linea.cantidad, linea.cantidad_texto, linea.unidad)} ${linea.nombre}`
      )
      .join(", ");

    const observacionesFinales = observaciones.trim() || null;

    const resultado = await crearPedido(supabase, {
      origen: "manual",
      cliente_id: clienteSeleccionado.id,
      tipo_cliente_id: clienteSeleccionado.tipo_cliente_id,
      lista_precio_id: listaResuelta?.id ?? null,
      mensaje_original: pedidoRapidoActivo
        ? `Pedido rápido — ${nombreRapido.trim()} — ${resumenProductos}`
        : `Pedido manual — ${resumenProductos}`,
      observaciones: observacionesFinales,
      cliente_nombre_temporal: pedidoRapidoActivo
        ? nombreRapido.trim()
        : null,
      cliente_telefono_temporal: null,
      total,
      lineas: lineas.map((linea) => ({
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
      })),
      validarCredito: !pedidoRapidoActivo,
      limite_credito: Number(clienteSeleccionado.limite_credito ?? 0),
    });

    if (!resultado.ok) {
      setError(resultado.error);
      setGuardando(false);
      return;
    }

    router.push(`/dashboard/pedidos/${resultado.pedidoId}?creado=1`);
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
    <div className="mx-auto max-w-4xl space-y-8 pb-32">
      {error ? (
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-base text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 sm:p-7">
        <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">Cliente</h2>

        {modoInicio === "seleccion" && !clienteListo ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setModoInicio("registrado")}
              className="min-h-[5.5rem] rounded-2xl border-2 border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5 text-left transition hover:border-zinc-300 hover:shadow-md active:scale-[0.99]"
            >
              <span className="text-3xl" aria-hidden>
                🟢
              </span>
              <p className="mt-3 text-xl font-bold text-zinc-900">
                Cliente registrado
              </p>
              <p className="mt-1 text-base text-zinc-500">
                Buscar en el catálogo de clientes
              </p>
            </button>

            <button
              type="button"
              onClick={() => setModoInicio("rapido")}
              className="min-h-[5.5rem] rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 text-left transition hover:border-amber-300 hover:shadow-md active:scale-[0.99]"
            >
              <span className="text-3xl" aria-hidden>
                ⚡
              </span>
              <p className="mt-3 text-xl font-bold text-zinc-900">
                Pedido rápido
              </p>
              <p className="mt-1 text-base text-zinc-500">
                Solo nombre, sin registrar cliente
              </p>
            </button>
          </div>
        ) : null}

        {modoInicio === "rapido" && !clienteListo ? (
          <div className="mt-5 space-y-4">
            <button
              type="button"
              onClick={() => setModoInicio("seleccion")}
              className="text-base font-medium text-zinc-500 hover:text-zinc-900"
            >
              ← Elegir otro modo
            </button>

            <div>
              <label
                htmlFor="nombre-rapido"
                className="mb-3 block text-base font-semibold text-zinc-700"
              >
                Nombre del cliente o negocio
                <span className="ml-1 font-normal text-red-600">*</span>
              </label>
              <input
                id="nombre-rapido"
                type="text"
                value={nombreRapido}
                onChange={(event) => setNombreRapido(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && nombreRapido.trim()) {
                    event.preventDefault();
                    void continuarPedidoRapido();
                  }
                }}
                placeholder="Ej. Carnicería Lety, Fonda Lupita..."
                className="w-full rounded-xl border border-zinc-300 px-4 py-3.5 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 sm:py-4 sm:text-lg"
                autoFocus
              />
            </div>

            {sugerenciasRapido.length > 0 ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                  ¿Quisiste decir...?
                </p>
                <ul className="mt-3 space-y-2">
                  {sugerenciasRapido.map((cliente) => {
                    const tipo = resolverJoin(cliente.tipos_cliente);
                    return (
                      <li key={cliente.id}>
                        <button
                          type="button"
                          onClick={() => elegirClienteDesdeSugerencia(cliente)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 text-left ring-1 ring-blue-100 transition hover:bg-blue-50"
                        >
                          <span className="text-base font-semibold text-zinc-900">
                            {cliente.nombre_negocio}
                          </span>
                          {tipo ? (
                            <span className="text-sm text-zinc-500">
                              {tipo.nombre}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <button
              type="button"
              onClick={continuarPedidoRapido}
              disabled={!nombreRapido.trim()}
              className="min-h-[3.5rem] w-full rounded-xl bg-green-600 px-6 py-4 text-lg font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar
            </button>
          </div>
        ) : null}

        {modoInicio === "registrado" && !clienteListo ? (
          <div className="mt-5 space-y-4">
            <button
              type="button"
              onClick={() => setModoInicio("seleccion")}
              className="text-base font-medium text-zinc-500 hover:text-zinc-900"
            >
              ← Elegir otro modo
            </button>

            <input
              type="text"
              value={busquedaCliente}
              onChange={(event) => setBusquedaCliente(event.target.value)}
              placeholder="Buscar por negocio, dueño o tipo..."
              className="w-full rounded-xl border border-zinc-300 px-4 py-3.5 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 sm:py-4 sm:text-lg"
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
              className="w-full rounded-xl border border-zinc-300 px-4 py-3.5 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 sm:py-4 sm:text-lg"
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
              <p className="text-base text-zinc-500">
                No se encontraron clientes activos con ese criterio.
              </p>
            ) : null}
          </div>
        ) : null}

        {clienteListo ? (
          <div className="mt-5 rounded-2xl border-2 border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                {pedidoRapidoActivo ? (
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                    {ETIQUETA_CLIENTE_TEMPORAL}
                  </span>
                ) : null}
                <p className="text-2xl font-bold leading-tight text-zinc-900 sm:text-3xl">
                  {nombreClienteMostrar}
                </p>
                {!pedidoRapidoActivo && clienteSeleccionado?.propietario?.trim() ? (
                  <p className="mt-1 text-base text-zinc-600 sm:text-lg">
                    {clienteSeleccionado.propietario.trim()}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={limpiarCliente}
                className="shrink-0 rounded-xl border-2 border-zinc-300 bg-white px-5 py-2.5 text-base font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
              >
                Cambiar
              </button>
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-zinc-200">
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Tipo de cliente
                </dt>
                <dd className="mt-1.5 text-lg font-bold text-zinc-900">
                  {tipoClienteNombre}
                </dd>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-zinc-200">
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Lista de precios
                </dt>
                <dd className="mt-1.5 text-lg font-bold text-zinc-900">
                  {cargandoLista
                    ? "Cargando..."
                    : listaResuelta
                      ? `${listaResuelta.nombre}${listaResuelta.esOverride ? " (asignada al cliente)" : " (vigente)"}`
                      : "Sin lista vigente — publica un Balance"}
                </dd>
              </div>
            </dl>

            {!pedidoRapidoActivo && validandoCredito ? (
              <p className="mt-4 text-base text-zinc-500">
                Validando crédito del cliente...
              </p>
            ) : null}

            {!pedidoRapidoActivo && advertenciaCredito ? (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-base text-red-700 ring-1 ring-red-200">
                {advertenciaCredito}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section
        className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 sm:p-7 ${!clienteListo ? "opacity-50" : ""}`}
      >
        <h2 className="text-xl font-bold text-zinc-900 sm:text-2xl">Productos</h2>

        <div className="mt-5 space-y-6">
          <div>
            <p className="mb-3 text-base font-semibold text-zinc-700">Categoría</p>
            <div className="flex flex-wrap gap-3">
              {CATEGORIAS_PRODUCTO.map((categoria) => (
                <button
                  key={categoria}
                  type="button"
                  onClick={() => cambiarCategoria(categoria)}
                  disabled={!clienteSeleccionado || cargandoLista}
                  className={`min-h-[3.25rem] rounded-xl px-6 py-3.5 text-base font-bold transition disabled:cursor-not-allowed disabled:opacity-40 sm:px-8 sm:text-lg ${
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
              className="mb-3 block text-base font-semibold text-zinc-700"
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
                className="w-full rounded-xl border border-zinc-300 px-4 py-3.5 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400 sm:py-4 sm:text-lg"
              />

              {comboboxAbierto &&
              clienteSeleccionado &&
              productosCombobox.length > 0 ? (
                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
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
                          className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left hover:bg-zinc-50"
                        >
                          <span className="text-base font-semibold text-zinc-900">
                            {producto.nombre}
                          </span>
                          <span className="shrink-0 text-base text-zinc-500">
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
                <p className="absolute z-10 mt-1 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-base text-zinc-500 shadow-lg">
                  No hay productos en {categoriaCaptura} con ese criterio.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div>
              <p className="mb-3 text-base font-semibold text-zinc-700">Captura</p>
              <SelectorModoCaptura
                value={modoCaptura}
                onChange={setModoCaptura}
                disabled={!productoSeleccionado}
                grande
              />
            </div>

            <div className="min-w-[160px] flex-1">
              <label
                htmlFor="cantidad-captura"
                className="mb-3 block text-base font-semibold text-zinc-700"
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
                className="w-full rounded-xl border border-zinc-300 px-4 py-3.5 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-400 sm:py-4 sm:text-lg"
              />
            </div>

            <button
              type="button"
              onClick={agregarLineaCaptura}
              disabled={!clienteSeleccionado || !productoSeleccionado}
              className="min-h-[3.25rem] w-full rounded-xl bg-zinc-900 px-6 py-3.5 text-base font-bold text-white shadow-md transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-8 sm:text-lg"
            >
              ➕ Agregar al pedido
            </button>
          </div>
        </div>

        {lineas.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center text-base text-zinc-500">
            {clienteSeleccionado
              ? "Elige categoría, producto y cantidad para agregar al pedido."
              : "La captura de productos se habilita al elegir un cliente."}
          </p>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[920px] border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  <th className="pb-2 pr-4">Producto</th>
                  <th className="pb-2 pr-4">Cantidad</th>
                  <th className="pb-2 pr-4">Precio de lista</th>
                  <th className="pb-2 pr-4">Precio aplicado</th>
                  <th className="pb-2 pr-4">Peso total (kg)</th>
                  <th className="pb-2 pr-4">Subtotal</th>
                  <th className="pb-2">Acciones</th>
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
                  <tr key={linea.key} className="bg-zinc-50">
                    <td className="rounded-l-xl py-4 pr-4 pl-3">
                      <p className="text-base font-semibold text-zinc-900">{linea.nombre}</p>
                    </td>
                    <td className="py-4 pr-4">
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
                        grande
                      />
                    </td>
                    <td className="py-4 pr-4 text-base text-zinc-600">
                      {formatMoneda(linea.precio_lista)}
                    </td>
                    <td className="py-4 pr-4">
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
                        className={`w-32 rounded-xl border px-3 py-2.5 text-base text-zinc-900 ${
                          linea.precio_modificado
                            ? "border-amber-300 bg-amber-50"
                            : "border-zinc-300"
                        }`}
                      />
                    </td>
                    <td className="py-4 pr-4">
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
                          className="w-28 rounded-xl border border-zinc-300 px-3 py-2.5 text-base text-zinc-900"
                        />
                      ) : (
                        <span className="text-base text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="py-4 pr-4 text-base font-bold text-zinc-900">
                      {subtotalTexto ? (
                        subtotalTexto
                      ) : (
                        <span className="font-normal text-zinc-400">Pendiente</span>
                      )}
                    </td>
                    <td className="rounded-r-xl py-4 pr-3">
                      <button
                        type="button"
                        onClick={() => eliminarLinea(linea.key)}
                        className="min-h-[2.75rem] rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-base font-semibold text-red-700 transition hover:bg-red-100"
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

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 sm:p-7">
        <label
          htmlFor="observaciones"
          className="block text-base font-semibold text-zinc-700 sm:text-lg"
        >
          Observaciones
          <span className="ml-1 font-normal text-zinc-400">(opcional)</span>
        </label>
        <textarea
          id="observaciones"
          rows={3}
          value={observaciones}
          onChange={(event) => setObservaciones(event.target.value)}
          placeholder="Instrucciones de entrega, corte especial, etc."
          className="mt-3 w-full rounded-xl border border-zinc-300 px-4 py-3 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 sm:text-lg"
        />
      </section>

      <div className="sticky bottom-4 flex flex-col gap-4 rounded-2xl bg-zinc-900 px-5 py-5 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
        <div>
          <p className="text-base text-zinc-300 sm:text-lg">Total del pedido</p>
          <p className="text-4xl font-bold tracking-tight sm:text-5xl">{formatMoneda(total)}</p>
          <p className="mt-1 text-sm text-zinc-400">
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
            (!pedidoRapidoActivo &&
              (validandoCredito || Boolean(advertenciaCredito)))
          }
          className="min-h-[3.5rem] w-full rounded-xl bg-green-600 px-8 py-4 text-lg font-bold uppercase tracking-wide text-white shadow-lg transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[240px] sm:text-xl"
        >
          {guardando ? "Guardando..." : "✅ GUARDAR PEDIDO"}
        </button>
      </div>
    </div>
  );
}
