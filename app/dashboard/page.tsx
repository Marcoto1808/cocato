import { supabase } from "@/lib/supabase";
import { obtenerSesion } from "@/lib/auth-server";
import { generarSaludo } from "@/lib/dashboard-admin";
import CerrarSesionButton from "@/components/navegacion/CerrarSesionButton";
import DashboardTrabajador, {
  contarClientesNuevosHoy,
  contarPedidosDashboard,
} from "@/components/dashboard/DashboardTrabajador";
import {
  modulosDisponibles,
  type Modulo,
  type RolUsuario,
} from "@/lib/roles";
import Link from "next/link";

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
  cobranza: {
    href: "/cobranza",
    icono: "💳",
    titulo: "Cobranza",
    descripcion: "Cartera y pagos pendientes",
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
  const modulos =
    rol === "colaborador"
      ? modulosDisponibles(rol).filter((modulo) => modulo !== "cobranza")
      : modulosDisponibles(rol);

  return modulos
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

  if (rol === "colaborador") {
    const [pedidosRes, clientesRes, productosRes, listasRes] =
      await Promise.all([
        supabase.from("pedidos").select("estado, updated_at"),
        supabase.from("clientes").select("created_at").eq("activo", true),
        supabase.from("productos").select("id").eq("activo", true),
        supabase
          .from("listas_precio")
          .select("publicada_en")
          .not("publicada_en", "is", null)
          .order("publicada_en", { ascending: false })
          .limit(1),
      ]);

    const resumenPedidos = contarPedidosDashboard(pedidosRes.data ?? []);
    const totalClientes = clientesRes.data?.length ?? 0;
    const clientesNuevosHoy = contarClientesNuevosHoy(clientesRes.data ?? []);
    const productosActivos = productosRes.data?.length ?? 0;
    const ultimaActualizacionPrecios =
      listasRes.data?.[0]?.publicada_en ?? null;

    return (
      <main className="min-h-screen bg-zinc-100 px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto mb-5 flex max-w-3xl items-start justify-between gap-4">
          <h1 className="text-2xl font-bold leading-tight text-zinc-900 sm:text-3xl">
            {saludo}
          </h1>
          <CerrarSesionButton />
        </div>

        <DashboardTrabajador
          resumenPedidos={resumenPedidos}
          totalClientes={totalClientes}
          clientesNuevosHoy={clientesNuevosHoy}
          productosActivos={productosActivos}
          ultimaActualizacionPrecios={ultimaActualizacionPrecios}
        />
      </main>
    );
  }

  const tarjetas = tarjetasParaRol(rol);

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
        {tarjetas.map((tarjeta) => (
          <Link key={tarjeta.href} href={tarjeta.href}>
            <div className="cursor-pointer rounded-xl bg-white p-6 shadow transition hover:bg-zinc-50">
              <h2 className="text-xl font-bold">
                {tarjeta.icono} {tarjeta.titulo}
              </h2>
              <p className="mt-2 text-zinc-500">{tarjeta.descripcion}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
