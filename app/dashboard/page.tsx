import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { esPedidoActivo } from "@/lib/pedido-estados";
import { obtenerSesion } from "@/lib/auth-server";
import { generarSaludo } from "@/lib/dashboard-admin";
import CerrarSesionButton from "@/components/navegacion/CerrarSesionButton";
import {
  modulosDisponibles,
  type Modulo,
  type RolUsuario,
} from "@/lib/roles";

export const dynamic = "force-dynamic";

const TARJETAS_MODULO: Partial<
  Record<
    Modulo,
    { href: string; icono: string; titulo: string; descripcion: string }
  >
> = {
  clientes: {
    href: "/clientes",
    icono: "👥",
    titulo: "Clientes",
    descripcion: "Administrar clientes",
  },
  productos: {
    href: "/productos",
    icono: "🥩",
    titulo: "Productos",
    descripcion: "Administrar productos",
  },
  pedidos: {
    href: "/dashboard/pedidos",
    icono: "📦",
    titulo: "Pedidos",
    descripcion: "Ver pedidos del día",
  },
  balance: {
    href: "/balance",
    icono: "💰",
    titulo: "Balance",
    descripcion: "Listas de precios y balance",
  },
};

function tarjetasParaRol(rol: RolUsuario) {
  return modulosDisponibles(rol)
    .map((modulo) => TARJETAS_MODULO[modulo])
    .filter(
      (
        tarjeta
      ): tarjeta is {
        href: string;
        icono: string;
        titulo: string;
        descripcion: string;
      } => tarjeta !== undefined
    );
}

export default async function Dashboard() {
  const sesion = await obtenerSesion();
  const rol = sesion?.rol ?? "colaborador";
  const saludo = generarSaludo(sesion?.nombre, sesion?.usuario);
  const tarjetas = tarjetasParaRol(rol);

  const { data: pedidos } = await supabase.from("pedidos").select("estado");

  const pedidosActivos = (pedidos ?? []).filter((pedido) =>
    esPedidoActivo(pedido.estado)
  ).length;

  return (
    <main className="min-h-screen bg-zinc-100 p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{saludo}</h1>
        </div>
        <CerrarSesionButton />
      </div>

      <div
        className={`mt-10 grid gap-6 ${
          tarjetas.length === 1 ? "max-w-md" : "grid-cols-2"
        }`}
      >
        {tarjetas.map((tarjeta) => {
          const esPedidos = tarjeta.href === "/dashboard/pedidos";

          return (
            <Link key={tarjeta.href} href={tarjeta.href}>
              <div
                className={`cursor-pointer rounded-xl bg-white p-6 shadow transition hover:bg-zinc-50 ${
                  esPedidos ? "border-2 border-blue-500" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-bold">
                    {tarjeta.icono} {tarjeta.titulo}
                  </h2>
                  {esPedidos ? (
                    pedidosActivos > 0 ? (
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
                    )
                  ) : null}
                </div>
                <p className="mt-2 text-zinc-500">{tarjeta.descripcion}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
