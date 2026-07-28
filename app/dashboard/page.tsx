import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { esPedidoActivo } from "@/lib/pedido-estados";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { data: pedidos } = await supabase.from("pedidos").select("estado");

  const pedidosActivos = (pedidos ?? []).filter((pedido) =>
    esPedidoActivo(pedido.estado)
  ).length;

  return (
    <main className="min-h-screen bg-zinc-100 p-8">
      <h1 className="text-3xl font-bold">Bienvenido a COCATO</h1>

      <p className="mt-2 text-zinc-600">Has iniciado sesión correctamente.</p>

      <div className="mt-10 grid grid-cols-2 gap-6">
        <Link href="/clientes">
          <div className="cursor-pointer rounded-xl bg-white p-6 shadow transition hover:bg-zinc-50">
            <h2 className="text-xl font-bold">👥 Clientes</h2>
            <p className="mt-2 text-zinc-500">Administrar clientes</p>
          </div>
        </Link>

        <Link href="/productos">
          <div className="cursor-pointer rounded-xl bg-white p-6 shadow transition hover:bg-zinc-50">
            <h2 className="text-xl font-bold">🥩 Productos</h2>
            <p className="mt-2 text-zinc-500">Administrar productos</p>
          </div>
        </Link>

        <Link href="/dashboard/pedidos">
          <div className="cursor-pointer rounded-xl border-2 border-blue-500 bg-white p-6 shadow transition hover:bg-zinc-50">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold">📦 Pedidos</h2>
              {pedidosActivos > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none">🔴</span>
                  <span className="text-5xl font-bold leading-none text-red-600">
                    {pedidosActivos}
                  </span>
                </div>
              ) : (
                <span className="max-w-[9rem] text-right text-sm font-semibold leading-snug text-emerald-600">
                  🟢 Sin pedidos pendientes
                </span>
              )}
            </div>
            <p className="mt-2 text-zinc-500">Ver pedidos del día</p>
          </div>
        </Link>
      </div>
    </main>
  );
}
