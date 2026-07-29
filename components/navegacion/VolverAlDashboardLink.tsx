"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RUTA_DASHBOARD_COLABORADOR } from "@/lib/navegacion-dashboard";

type Props = {
  className?: string;
  children?: React.ReactNode;
};

export default function VolverAlDashboardLink({
  className = "mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-900",
  children = "← Volver al Dashboard",
}: Props) {
  const [rutaDashboard, setRutaDashboard] = useState(RUTA_DASHBOARD_COLABORADOR);

  useEffect(() => {
    let activo = true;

    fetch("/api/auth/session")
      .then(async (respuesta) => {
        if (!respuesta.ok) return null;
        return respuesta.json();
      })
      .then((datos) => {
        if (!activo || !datos?.dashboardPath) return;
        setRutaDashboard(datos.dashboardPath);
      })
      .catch(() => {});

    return () => {
      activo = false;
    };
  }, []);

  return (
    <Link href={rutaDashboard} className={className}>
      {children}
    </Link>
  );
}
