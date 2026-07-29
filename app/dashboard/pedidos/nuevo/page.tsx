import Link from "next/link";
import { redirect } from "next/navigation";
import { requerirSesion } from "@/lib/auth-server";
import { puedeUsarPermisoPedido } from "@/lib/roles";
import NuevoPedidoForm from "./NuevoPedidoForm";

export const dynamic = "force-dynamic";

export default async function NuevoPedidoPage() {
  const sesion = await requerirSesion();

  if (!puedeUsarPermisoPedido(sesion.rol, "crear")) {
    redirect("/dashboard/pedidos");
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-8 pb-28">
      <Link
        href="/dashboard/pedidos"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Volver a Pedidos
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Nuevo pedido</h1>
        <p className="mt-1 text-zinc-500">Captura rápida de pedidos</p>
      </div>

      <NuevoPedidoForm />
    </main>
  );
}
