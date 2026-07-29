"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  RUTA_DASHBOARD_COLABORADOR,
  leerRutaDashboardDesdeDocumento,
} from "@/lib/navegacion-dashboard";

type Props = {
  className?: string;
  children?: React.ReactNode;
};

function suscribirSinOp() {
  return () => {};
}

function leerRutaDashboardCliente() {
  return leerRutaDashboardDesdeDocumento();
}

function rutaDashboardServidor() {
  return RUTA_DASHBOARD_COLABORADOR;
}

export default function VolverAlDashboardLink({
  className = "mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900",
  children = "← Volver al Dashboard",
}: Props) {
  const rutaDashboard = useSyncExternalStore(
    suscribirSinOp,
    leerRutaDashboardCliente,
    rutaDashboardServidor
  );

  return (
    <Link href={rutaDashboard} className={className}>
      {children}
    </Link>
  );
}
