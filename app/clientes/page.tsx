"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ClientesTable from "@/components/clientes/ClientesTable";

type Cliente = {
  id: string;
  nombre_negocio: string;
  propietario: string | null;
  whatsapp: string | null;
  telefono: string | null;
  direccion: string | null;
};

type FormularioCliente = {
  nombre_negocio: string;
  propietario: string;
  whatsapp: string;
  telefono: string;
  direccion: string;
};

const FORMULARIO_VACIO: FormularioCliente = {
  nombre_negocio: "",
  propietario: "",
  whatsapp: "",
  telefono: "",
  direccion: "",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      .select("id, nombre_negocio, propietario, whatsapp, telefono, direccion")
      .order("nombre_negocio");

    if (queryError) {
      setError("No se pudieron cargar los clientes.");
      setCargando(false);
      return;
    }

    setClientes((data ?? []) as Cliente[]);
    setCargando(false);
  }

  function abrirModalNuevo() {
    setFormulario(FORMULARIO_VACIO);
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

    const payload = {
      nombre_negocio,
      propietario: formulario.propietario.trim() || null,
      whatsapp: formulario.whatsapp.trim() || null,
      telefono: formulario.telefono.trim() || null,
      direccion: formulario.direccion.trim() || null,
    };

    const { error: insertError } = await supabase
      .from("clientes")
      .insert(payload);

    if (insertError) {
      setError("No se pudo guardar el cliente.");
      setGuardando(false);
      return;
    }

    cerrarModal();
    setGuardando(false);
    await cargarClientes();
  }

  const clientesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    if (!termino) return clientes;

    return clientes.filter((cliente) => {
      const campos = [
        cliente.nombre_negocio,
        cliente.propietario,
        cliente.whatsapp,
        cliente.telefono,
        cliente.direccion,
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

      {error && (
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
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg ring-1 ring-zinc-200">
            <h2 className="text-xl font-bold text-zinc-900">Nuevo cliente</h2>

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
                  Propietario
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
