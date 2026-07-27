import Link from "next/link";
import { supabase } from "@/lib/supabase";
import NuevoPedidoForm from "./NuevoPedidoForm";

export const dynamic = "force-dynamic";

type Cliente = {
  id: string;
  nombre_negocio: string;
  propietario: string | null;
};

export default async function NuevoPedidoPage() {
  const { data: clientes, error } = await supabase
    .from("clientes")
    .select("id, nombre_negocio, propietario")
    .order("nombre_negocio");

  return (
    <main className="min-h-screen bg-zinc-100 p-8">
      <Link
        href="/dashboard/pedidos"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Volver a Pedidos
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Nuevo pedido</h1>
        <p className="mt-1 text-zinc-500">
          Registra un pedido para la bandeja de trabajo
        </p>
      </div>

      {error ? (
        <div className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <p className="text-red-600">Error al cargar los clientes.</p>
        </div>
      ) : (clientes ?? []).length === 0 ? (
        <div className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
          <p className="text-zinc-600">
            No hay clientes registrados. Agrega clientes antes de crear un
            pedido.
          </p>
        </div>
      ) : (
        <NuevoPedidoForm clientes={(clientes ?? []) as Cliente[]} />
      )}
    </main>
  );
}
