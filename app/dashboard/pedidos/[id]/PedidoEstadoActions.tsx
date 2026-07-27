"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type EstadoCategoria =
  | "pendiente"
  | "preparando"
  | "listo"
  | "reparto"
  | "entregado";

const ESTADOS = [
  {
    valor: "Preparando",
    etiqueta: "PREPARANDO",
    categoria: "preparando" as const,
  },
  {
    valor: "En reparto",
    etiqueta: "En reparto",
    categoria: "reparto" as const,
  },
  {
    valor: "Entregado",
    etiqueta: "Entregado",
    categoria: "entregado" as const,
  },
];

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

function normalizarEstado(estado: string): EstadoCategoria | null {
  const valor = estado.toLowerCase().trim();

  if (valor.includes("pendiente")) return "pendiente";
  if (valor.includes("listo")) return "listo";
  if (valor.includes("preparando")) return "preparando";
  if (valor.includes("reparto")) return "reparto";
  if (valor.includes("entregado")) return "entregado";

  return null;
}

function estadoEsActivo(estadoActual: string | null, valor: string) {
  if (!estadoActual) return false;
  return estadoActual.toLowerCase() === valor.toLowerCase();
}

function etiquetaEstado(estado: string | null) {
  if (!estado) return "Sin estado";

  const categoria = normalizarEstado(estado);

  switch (categoria) {
    case "pendiente":
      return "🟡 Pendiente";
    case "preparando":
      return "🟡 Preparando";
    case "listo":
      return "🟢 Listo";
    case "reparto":
      return "🚚 En reparto";
    case "entregado":
      return "✅ Entregado";
    default:
      return estado;
  }
}

function estiloEstado(estado: string | null) {
  if (!estado) {
    return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  }

  const categoria = normalizarEstado(estado);

  switch (categoria) {
    case "pendiente":
      return "bg-amber-100 text-amber-800 ring-amber-200";
    case "preparando":
      return "bg-amber-100 text-amber-800 ring-amber-200";
    case "listo":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "reparto":
      return "bg-blue-100 text-blue-800 ring-blue-200";
    case "entregado":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    default:
      return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  }
}

function estiloBoton(categoria: EstadoCategoria, activo: boolean) {
  if (activo) {
    return "cursor-default border-zinc-300 bg-zinc-100 text-zinc-500";
  }

  switch (categoria) {
    case "preparando":
      return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
    case "listo":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
    case "reparto":
      return "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100";
    case "entregado":
      return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
    default:
      return "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50";
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
      router.push(
        `/dashboard/pedidos?actualizado=${encodeURIComponent(nuevoEstado)}`
      );
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

export function PedidoEstadoBotones() {
  const { estado, cargando, confirmacion, error, cambiarEstado } =
    usePedidoEstado();

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
        Cambiar estado
      </h2>

      {confirmacion && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          {confirmacion}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {ESTADOS.map(({ valor, etiqueta, categoria }) => {
          const activo = estadoEsActivo(estado, valor);
          const procesando = cargando === valor;

          return (
            <button
              key={valor}
              type="button"
              disabled={activo || cargando !== null}
              onClick={() => cambiarEstado(valor)}
              className={`rounded-lg border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed ${estiloBoton(categoria, activo)}`}
            >
              {procesando ? "Guardando..." : etiqueta}
              {activo && (
                <span className="mt-1 block text-xs font-normal">
                  Estado actual
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
