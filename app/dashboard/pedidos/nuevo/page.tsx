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
    <main className="min-h-screen bg-zinc-100 p-4 pb-32 sm:p-8">
      <Link
        href="/dashboard/pedidos"
        className="mb-6 inline-block text-base text-zinc-500 hover:text-zinc-900"
      >
        ← Volver a Pedidos
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold sm:text-4xl">Nuevo pedido</h1>
        <p className="mt-2 text-base text-zinc-500 sm:text-lg">Captura rápida de pedidos</p>
      </div>

      <NuevoPedidoForm />
    </main>
  );
}
