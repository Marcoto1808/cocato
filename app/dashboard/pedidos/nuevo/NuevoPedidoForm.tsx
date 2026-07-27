"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Cliente = {
  id: string;
  nombre_negocio: string;
  propietario: string | null;
};

type Props = {
  clientes: Cliente[];
};

export default function NuevoPedidoForm({ clientes }: Props) {
  const router = useRouter();
  const [clienteId, setClienteId] = useState("");
  const [mensajeOriginal, setMensajeOriginal] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!clienteId) {
      setError("Selecciona un cliente.");
      return;
    }

    if (!mensajeOriginal.trim()) {
      setError("Escribe el mensaje original del pedido.");
      return;
    }

    setGuardando(true);

    const { error: insertError } = await supabase.from("pedidos").insert({
      cliente_id: clienteId,
      mensaje_original: mensajeOriginal.trim(),
      observaciones: observaciones.trim() || null,
      estado: "Pendiente",
      fecha: new Date().toISOString(),
      total: 0,
    });

    if (insertError) {
      setError("No se pudo crear el pedido. Intenta de nuevo.");
      setGuardando(false);
      return;
    }

    router.push("/dashboard/pedidos?creado=1");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-2xl space-y-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200"
    >
      <div>
        <label
          htmlFor="cliente"
          className="mb-2 block text-sm font-medium text-zinc-700"
        >
          Cliente
        </label>
        <select
          id="cliente"
          value={clienteId}
          onChange={(event) => setClienteId(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
          disabled={guardando}
        >
          <option value="">Selecciona un cliente</option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nombre_negocio}
              {cliente.propietario?.trim()
                ? ` — ${cliente.propietario.trim()}`
                : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="mensaje"
          className="mb-2 block text-sm font-medium text-zinc-700"
        >
          Mensaje original
        </label>
        <textarea
          id="mensaje"
          value={mensajeOriginal}
          onChange={(event) => setMensajeOriginal(event.target.value)}
          rows={5}
          placeholder="Ej. Quiero 2 kg de arrachera, 1 kg de molida y 500 g de chorizo"
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
          disabled={guardando}
        />
      </div>

      <div>
        <label
          htmlFor="observaciones"
          className="mb-2 block text-sm font-medium text-zinc-700"
        >
          Observaciones
        </label>
        <textarea
          id="observaciones"
          value={observaciones}
          onChange={(event) => setObservaciones(event.target.value)}
          rows={3}
          placeholder="Entrega antes de las 11:00, cortar en milanesa, etc."
          className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
          disabled={guardando}
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={guardando}
        className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {guardando ? "Creando pedido..." : "Crear pedido"}
      </button>
    </form>
  );
}
