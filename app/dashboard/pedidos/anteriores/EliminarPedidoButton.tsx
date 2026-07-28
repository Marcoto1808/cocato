"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const MENSAJE_CONFIRMACION =
  "¿Estás seguro de eliminar este pedido? Esta acción no se puede deshacer.";

type Props = {
  pedidoId: string;
};

export default function EliminarPedidoButton({ pedidoId }: Props) {
  const router = useRouter();
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEliminar() {
    if (eliminando) return;

    const confirmado = window.confirm(MENSAJE_CONFIRMACION);
    if (!confirmado) return;

    setEliminando(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", pedidoId);

    if (deleteError) {
      setError("No se pudo eliminar el pedido.");
      setEliminando(false);
      return;
    }

    router.push("/dashboard/pedidos/anteriores?eliminado=1");
    router.refresh();
  }

  return (
    <div>
      {error ? (
        <p className="mb-2 text-sm text-red-600">{error}</p>
      ) : null}
      <button
        type="button"
        onClick={handleEliminar}
        disabled={eliminando}
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {eliminando ? "Eliminando..." : "Eliminar pedido"}
      </button>
    </div>
  );
}
