"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  esPedidoEntregado,
  etiquetaEstado,
  normalizarEstado,
} from "@/lib/pedido-estados";

type PedidoEstadoContextValue = {
  estado: string | null;
  cargando: string | null;
  confirmacion: string | null;
  error: string | null;
  cambiarEstado: (nuevoEstado: string) => Promise<void>;
};

const PedidoEstadoContext = createContext<PedidoEstadoContextValue | null>(
  null
);

function estiloEstado(estado: string | null) {
  if (!estado) {
    return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  }

  const categoria = normalizarEstado(estado);

  switch (categoria) {
    case "pendiente":
      return "bg-amber-100 text-amber-800 ring-amber-200";
    case "listo":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "entregado":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    default:
      return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  }
}

function usePedidoEstado() {
  const context = useContext(PedidoEstadoContext);

  if (!context) {
    throw new Error("usePedidoEstado debe usarse dentro de PedidoEstadoProvider");
  }

  return context;
}

type ProviderProps = {
  pedidoId: string;
  estadoInicial: string | null;
  children: ReactNode;
};

export function PedidoEstadoProvider({
  pedidoId,
  estadoInicial,
  children,
}: ProviderProps) {
  const router = useRouter();
  const [estado, setEstado] = useState(estadoInicial);
  const [cargando, setCargando] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cambiarEstado(nuevoEstado: string) {
    if (cargando) return;

    setCargando(nuevoEstado);
    setError(null);
    setConfirmacion(null);

    const { error: updateError } = await supabase
      .from("pedidos")
      .update({ estado: nuevoEstado })
      .eq("id", pedidoId);

    if (updateError) {
      setError("No se pudo actualizar el estado.");
      setCargando(null);
      return;
    }

    setEstado(nuevoEstado);
    setConfirmacion(`Estado actualizado a ${nuevoEstado}`);
    setCargando(null);

    window.setTimeout(() => {
      const destino = esPedidoEntregado(nuevoEstado)
        ? `/dashboard/pedidos/anteriores?actualizado=${encodeURIComponent(nuevoEstado)}`
        : `/dashboard/pedidos?actualizado=${encodeURIComponent(nuevoEstado)}`;

      router.push(destino);
      router.refresh();
    }, 1500);
  }

  return (
    <PedidoEstadoContext.Provider
      value={{
        estado,
        cargando,
        confirmacion,
        error,
        cambiarEstado,
      }}
    >
      {children}
    </PedidoEstadoContext.Provider>
  );
}

export function PedidoEstadoBadge() {
  const { estado } = usePedidoEstado();

  if (!estado) return null;

  return (
    <span
      className={`mt-3 inline-block rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-inset ${estiloEstado(estado)}`}
    >
      {etiquetaEstado(estado)}
    </span>
  );
}

export function PedidoMarcarListo() {
  const { estado, cargando, confirmacion, error, cambiarEstado } =
    usePedidoEstado();

  const categoria = estado ? normalizarEstado(estado) : null;
  const yaListo = categoria === "listo" || categoria === "entregado";
  const procesando = cargando === "Listo";

  return (
    <div>
      {confirmacion ? (
        <div className="mb-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          {confirmacion}
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={yaListo || cargando !== null}
        onClick={() => cambiarEstado("Listo")}
        className="w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3.5 text-base font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {procesando
          ? "Guardando..."
          : yaListo
            ? "Pedido marcado como listo"
            : "Marcar como listo"}
      </button>
    </div>
  );
}
