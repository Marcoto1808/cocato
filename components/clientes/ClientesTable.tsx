"use client";

import Link from "next/link";

type Cliente = {
  id: string;
  nombre_negocio: string;
  propietario: string | null;
  whatsapp: string | null;
  telefono?: string | null;
  direccion?: string | null;
};

type Props = {
  clientes: Cliente[];
  sinResultados?: boolean;
};

export default function ClientesTable({ clientes, sinResultados }: Props) {
  if (sinResultados) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        No se encontraron clientes con ese criterio.
      </div>
    );
  }

  if (clientes.length === 0) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
        No hay clientes registrados.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
      <table className="w-full">
        <thead className="bg-zinc-100">
          <tr>
            <th className="p-3 text-left text-sm font-medium text-zinc-600">
              Negocio
            </th>
            <th className="p-3 text-left text-sm font-medium text-zinc-600">
              Nombre del dueño
            </th>
            <th className="p-3 text-left text-sm font-medium text-zinc-600">
              WhatsApp
            </th>
            <th className="p-3 text-left text-sm font-medium text-zinc-600">
              Teléfono
            </th>
            <th className="p-3 text-left text-sm font-medium text-zinc-600">
              Cobranza
            </th>
          </tr>
        </thead>

        <tbody>
          {clientes.map((cliente) => (
            <tr key={cliente.id} className="border-t border-zinc-100">
              <td className="p-3 font-medium text-zinc-900">
                {cliente.nombre_negocio}
              </td>
              <td className="p-3 text-zinc-700">
                {cliente.propietario?.trim() || "—"}
              </td>
              <td className="p-3 text-zinc-700">
                {cliente.whatsapp?.trim() || "—"}
              </td>
              <td className="p-3 text-zinc-700">
                {cliente.telefono?.trim() || "—"}
              </td>
              <td className="p-3">
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-white"
                >
                  📋 Historial
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
