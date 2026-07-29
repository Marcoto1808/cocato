"use client";

import { useEffect, useMemo, useState } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import ClientesTable from "@/components/clientes/ClientesTable";
import VolverAlDashboardLink from "@/components/navegacion/VolverAlDashboardLink";

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

type TipoCliente = {
  id: string;
  nombre: string;
};

type ListaPrecio = {
  id: string;
  nombre: string;
  tipo_cliente_id: string;
  es_vigente: boolean;
};

type Cliente = {
  id: string;
  nombre_negocio: string;
  propietario: string | null;
  telefono: string | null;
  whatsapp: string | null;
  direccion: string | null;
  tipo_cliente_id: string;
  lista_precio_id: string | null;
  activo: boolean;
  tipos_cliente: TipoCliente | TipoCliente[] | null;
};

type FormularioCliente = {
  nombre_negocio: string;
  propietario: string;
  telefono: string;
  whatsapp: string;
  direccion: string;
  tipo_cliente_id: string;
  lista_precio_id: string;
  activo: boolean;
};

const FORMULARIO_VACIO: FormularioCliente = {
  nombre_negocio: "",
  propietario: "",
  telefono: "",
  whatsapp: "",
  direccion: "",
  tipo_cliente_id: "",
  lista_precio_id: "",
  activo: true,
};

const COLUMNAS_CLIENTE =
  "id, nombre_negocio, propietario, telefono, whatsapp, direccion, tipo_cliente_id, lista_precio_id, activo, tipos_cliente(nombre)";

function resolverTipoCliente(
  tipos: TipoCliente | TipoCliente[] | null | undefined
): TipoCliente | null {
  if (!tipos) return null;
  return Array.isArray(tipos) ? (tipos[0] ?? null) : tipos;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tiposCliente, setTiposCliente] = useState<TipoCliente[]>([]);
  const [listasPrecio, setListasPrecio] = useState<ListaPrecio[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [listaPersonalizada, setListaPersonalizada] = useState(false);
  const [formulario, setFormulario] =
    useState<FormularioCliente>(FORMULARIO_VACIO);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    setError(null);

    const [clientesRes, tiposRes, listasRes] = await Promise.all([
      supabase
        .from("clientes")
        .select(COLUMNAS_CLIENTE)
        .order("nombre_negocio"),
      supabase
        .from("tipos_cliente")
        .select("id, nombre")
        .eq("activo", true)
        .order("orden"),
      supabase
        .from("listas_precio")
        .select("id, nombre, tipo_cliente_id, es_vigente")
        .order("nombre"),
    ]);

    if (clientesRes.error) {
      console.error("[clientes] consulta clientes:", clientesRes.error);
      setError(
        `Falló la consulta de clientes. ${formatearErrorSupabase(clientesRes.error)}`
      );
      setCargando(false);
      return;
    }

    if (tiposRes.error) {
      console.error("[clientes] consulta tipos de cliente:", tiposRes.error);
      setError(
        `Falló la consulta de tipos de cliente. ${formatearErrorSupabase(tiposRes.error)}`
      );
      setCargando(false);
      return;
    }

    if (listasRes.error) {
      console.error("[clientes] consulta listas de precios:", listasRes.error);
      setError(
        `Falló la consulta de listas de precios. ${formatearErrorSupabase(listasRes.error)}`
      );
      setCargando(false);
      return;
    }

    setClientes((clientesRes.data ?? []) as Cliente[]);
    setTiposCliente((tiposRes.data ?? []) as TipoCliente[]);
    setListasPrecio((listasRes.data ?? []) as ListaPrecio[]);
    setCargando(false);
  }

  const listasFiltradas = useMemo(() => {
    if (!formulario.tipo_cliente_id) return [];
    return listasPrecio.filter(
      (lista) => lista.tipo_cliente_id === formulario.tipo_cliente_id
    );
  }, [formulario.tipo_cliente_id, listasPrecio]);

  function abrirModalNuevo() {
    setFormulario({
      ...FORMULARIO_VACIO,
      tipo_cliente_id: tiposCliente[0]?.id ?? "",
    });
    setListaPersonalizada(false);
    setError(null);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setListaPersonalizada(false);
    setFormulario(FORMULARIO_VACIO);
  }

  async function guardarCliente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nombre_negocio = formulario.nombre_negocio.trim();
    const tipo_cliente_id = formulario.tipo_cliente_id.trim();

    if (!nombre_negocio) {
      setError("El nombre del negocio es obligatorio.");
      return;
    }

    if (!tipo_cliente_id) {
      setError("Selecciona un tipo de cliente.");
      return;
    }

    setGuardando(true);
    setError(null);
    setMensajeExito(null);

    const payload = {
      nombre_negocio,
      propietario: formulario.propietario.trim() || null,
      telefono: formulario.telefono.trim() || null,
      whatsapp: formulario.whatsapp.trim() || null,
      direccion: formulario.direccion.trim() || null,
      tipo_cliente_id,
      lista_precio_id:
        listaPersonalizada && formulario.lista_precio_id.trim()
          ? formulario.lista_precio_id.trim()
          : null,
      activo: formulario.activo,
    };

    const { data, error: insertError } = await supabase
      .from("clientes")
      .insert(payload)
      .select(COLUMNAS_CLIENTE)
      .single();

    if (insertError || !data) {
      console.error("[clientes] insert error:", insertError);
      setError(
        `No se pudo guardar el cliente. ${formatearErrorSupabase(insertError)}`
      );
      setGuardando(false);
      return;
    }

    setClientes((prev) =>
      [...prev, data as Cliente].sort((a, b) =>
        a.nombre_negocio.localeCompare(b.nombre_negocio, "es")
      )
    );

    cerrarModal();
    setGuardando(false);
    setMensajeExito(`Cliente "${nombre_negocio}" guardado correctamente.`);
  }

  const clientesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    if (!termino) return clientes;

    return clientes.filter((cliente) => {
      const tipo = resolverTipoCliente(cliente.tipos_cliente);
      const campos = [
        cliente.nombre_negocio,
        cliente.propietario,
        cliente.telefono,
        cliente.whatsapp,
        cliente.direccion,
        tipo?.nombre,
      ];

      return campos.some((campo) => campo?.toLowerCase().includes(termino));
    });
  }, [clientes, busqueda]);

  return (
    <main className="min-h-screen bg-zinc-100 p-8">
      <VolverAlDashboardLink />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="mt-1 text-zinc-500">Directorio de clientes</p>
        </div>

        <button
          type="button"
          onClick={abrirModalNuevo}
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + Nuevo Cliente
        </button>
      </div>

      {mensajeExito && (
        <div className="mb-6 rounded-xl bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          {mensajeExito}
        </div>
      )}

      {error && !modalAbierto && (
        <div className="mb-6 rounded-xl bg-red-50 px-5 py-4 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <input
        type="text"
        placeholder="Buscar cliente..."
        value={busqueda}
        onChange={(event) => setBusqueda(event.target.value)}
        className="mb-6 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />

      {cargando ? (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          Cargando clientes...
        </div>
      ) : (
        <ClientesTable
          clientes={clientesFiltrados}
          sinResultados={clientes.length > 0 && clientesFiltrados.length === 0}
        />
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg ring-1 ring-zinc-200">
            <h2 className="text-xl font-bold text-zinc-900">Nuevo cliente</h2>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}

            <form onSubmit={guardarCliente} className="mt-6 space-y-5">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Información general
                </h3>

                <div>
                  <label
                    htmlFor="nombre_negocio"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Nombre del negocio
                  </label>
                  <input
                    id="nombre_negocio"
                    type="text"
                    required
                    value={formulario.nombre_negocio}
                    onChange={(event) =>
                      setFormulario({
                        ...formulario,
                        nombre_negocio: event.target.value,
                      })
                    }
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="propietario"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Nombre del dueño
                  </label>
                  <input
                    id="propietario"
                    type="text"
                    value={formulario.propietario}
                    onChange={(event) =>
                      setFormulario({
                        ...formulario,
                        propietario: event.target.value,
                      })
                    }
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="telefono"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Teléfono
                  </label>
                  <input
                    id="telefono"
                    type="text"
                    value={formulario.telefono}
                    onChange={(event) =>
                      setFormulario({
                        ...formulario,
                        telefono: event.target.value,
                      })
                    }
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="whatsapp"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    WhatsApp
                  </label>
                  <input
                    id="whatsapp"
                    type="text"
                    value={formulario.whatsapp}
                    onChange={(event) =>
                      setFormulario({
                        ...formulario,
                        whatsapp: event.target.value,
                      })
                    }
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="direccion"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Dirección
                  </label>
                  <textarea
                    id="direccion"
                    rows={3}
                    value={formulario.direccion}
                    onChange={(event) =>
                      setFormulario({
                        ...formulario,
                        direccion: event.target.value,
                      })
                    }
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="tipo_cliente_id"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Tipo de cliente
                  </label>
                  <select
                    id="tipo_cliente_id"
                    required
                    value={formulario.tipo_cliente_id}
                    onChange={(event) => {
                      setListaPersonalizada(false);
                      setFormulario({
                        ...formulario,
                        tipo_cliente_id: event.target.value,
                        lista_precio_id: "",
                      });
                    }}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value="">Seleccionar tipo...</option>
                    {tiposCliente.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  {!listaPersonalizada ? (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                      <p className="text-sm text-zinc-700">
                        <span className="font-medium text-zinc-900">
                          Lista de precios:
                        </span>{" "}
                        {formulario.tipo_cliente_id
                          ? "Automática (según el tipo de cliente)."
                          : "Selecciona un tipo de cliente."}
                      </p>
                      {formulario.tipo_cliente_id ? (
                        <button
                          type="button"
                          onClick={() => setListaPersonalizada(true)}
                          className="mt-2 text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-900"
                        >
                          Usar una lista de precios diferente
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label
                        htmlFor="lista_precio_id"
                        className="block text-sm font-medium text-zinc-700"
                      >
                        Lista de precios asignada
                      </label>
                      <select
                        id="lista_precio_id"
                        value={formulario.lista_precio_id}
                        onChange={(event) =>
                          setFormulario({
                            ...formulario,
                            lista_precio_id: event.target.value,
                          })
                        }
                        className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                      >
                        <option value="">Seleccionar lista...</option>
                        {listasFiltradas.map((lista) => (
                          <option key={lista.id} value={lista.id}>
                            {lista.nombre}
                            {lista.es_vigente ? " · vigente" : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setListaPersonalizada(false);
                          setFormulario((prev) => ({
                            ...prev,
                            lista_precio_id: "",
                          }));
                        }}
                        className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 hover:decoration-zinc-900"
                      >
                        Volver a lista automática
                      </button>
                    </div>
                  )}
                </div>

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
                  Cliente activo
                </label>
              </div>

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
