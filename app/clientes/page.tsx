"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import ClientesTable from "@/components/clientes/ClientesTable";

function formatearErrorSupabase(error: PostgrestError | null): string {
  if (!error) {
    return "Sin respuesta de Supabase (insert sin data).";
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

type Cliente = {
  id: string;
  nombre_negocio: string;
  propietario: string | null;
  whatsapp: string | null;
  telefono: string | null;
  direccion: string | null;
  maps_url: string | null;
  observaciones: string | null;
};

type FormularioCliente = {
  nombre_negocio: string;
  propietario: string;
  telefono: string;
  whatsapp: string;
  direccion: string;
  maps_url: string;
  observaciones: string;
};

const FORMULARIO_VACIO: FormularioCliente = {
  nombre_negocio: "",
  propietario: "",
  telefono: "",
  whatsapp: "",
  direccion: "",
  maps_url: "",
  observaciones: "",
};

// Deben coincidir con public.clientes en Supabase.
const COLUMNAS_CLIENTE =
  "id, nombre_negocio, propietario, telefono, whatsapp, direccion, maps_url, observaciones";

const COLUMNAS_INSERT = [
  "nombre_negocio",
  "propietario",
  "telefono",
  "whatsapp",
  "direccion",
  "maps_url",
  "observaciones",
] as const;

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [formulario, setFormulario] =
    useState<FormularioCliente>(FORMULARIO_VACIO);

  useEffect(() => {
    cargarClientes();
  }, []);

  async function cargarClientes() {
    setCargando(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("clientes")
      .select(COLUMNAS_CLIENTE)
      .order("nombre_negocio");

    if (queryError) {
      console.error("[clientes] select error:", queryError);
      console.error("[clientes] select columnas:", COLUMNAS_CLIENTE);
      setError(
        `No se pudieron cargar los clientes. ${formatearErrorSupabase(queryError)}`
      );
      setCargando(false);
      return;
    }

    setClientes((data ?? []) as Cliente[]);
    setCargando(false);
  }

  function abrirModalNuevo() {
    setFormulario(FORMULARIO_VACIO);
    setError(null);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setFormulario(FORMULARIO_VACIO);
  }

  async function guardarCliente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nombre_negocio = formulario.nombre_negocio.trim();

    if (!nombre_negocio) {
      setError("El nombre del negocio es obligatorio.");
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
      maps_url: formulario.maps_url.trim() || null,
      observaciones: formulario.observaciones.trim() || null,
    };

    console.log("[clientes] insert payload:", payload);
    console.log("[clientes] insert columnas enviadas:", COLUMNAS_INSERT);

    let nuevoCliente: Cliente | null = null;
    let insertError: PostgrestError | null = null;

    try {
      const resultado = await supabase
        .from("clientes")
        .insert(payload)
        .select(COLUMNAS_CLIENTE)
        .single();

      nuevoCliente = (resultado.data as Cliente | null) ?? null;
      insertError = resultado.error;
    } catch (caught) {
      console.error("[clientes] insert exception:", caught);
      setError(
        `No se pudo guardar el cliente. Excepción: ${
          caught instanceof Error ? caught.message : String(caught)
        }`
      );
      setGuardando(false);
      return;
    }

    if (insertError || !nuevoCliente) {
      console.error("[clientes] insert error.code:", insertError?.code);
      console.error("[clientes] insert error.message:", insertError?.message);
      console.error("[clientes] insert error.details:", insertError?.details);
      console.error("[clientes] insert error.hint:", insertError?.hint);
      console.error("[clientes] insert data:", nuevoCliente);
      setError(
        `No se pudo guardar el cliente. ${formatearErrorSupabase(insertError)}`
      );
      setGuardando(false);
      return;
    }

    setClientes((prev) =>
      [...prev, nuevoCliente as Cliente].sort((a, b) =>
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
      const campos = [
        cliente.nombre_negocio,
        cliente.propietario,
        cliente.telefono,
        cliente.whatsapp,
        cliente.direccion,
        cliente.observaciones,
      ];

      return campos.some((campo) =>
        campo?.toLowerCase().includes(termino)
      );
    });
  }, [clientes, busqueda]);

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

            <form onSubmit={guardarCliente} className="mt-6 space-y-4">
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
                  Nombre del contacto
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
                  htmlFor="maps_url"
                  className="block text-sm font-medium text-zinc-700"
                >
                  URL de Google Maps{" "}
                  <span className="font-normal text-zinc-400">(opcional)</span>
                </label>
                <input
                  id="maps_url"
                  type="text"
                  placeholder="https://maps.google.com/..."
                  value={formulario.maps_url}
                  onChange={(event) =>
                    setFormulario({
                      ...formulario,
                      maps_url: event.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div>
                <label
                  htmlFor="observaciones"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Observaciones
                </label>
                <textarea
                  id="observaciones"
                  rows={3}
                  placeholder="Horarios de entrega, preferencias, etc."
                  value={formulario.observaciones}
                  onChange={(event) =>
                    setFormulario({
                      ...formulario,
                      observaciones: event.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
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
