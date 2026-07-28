"use client";

import { useEffect, useState } from "react";

type Props = {
  saludo: string;
  fechaInicial: string;
  horaInicial: string;
  ultimaActualizacion: string;
};

export default function AdminBarraSuperior({
  saludo,
  fechaInicial,
  horaInicial,
  ultimaActualizacion,
}: Props) {
  const [horaActual, setHoraActual] = useState(horaInicial);

  useEffect(() => {
    function actualizarHora() {
      setHoraActual(
        new Date().toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }

    actualizarHora();
    const intervalo = window.setInterval(actualizarHora, 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  return (
    <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            COCATO · Administración
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
            {saludo}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Estado operativo del negocio en un vistazo.
          </p>
        </div>

        <dl className="grid gap-2 text-right text-sm sm:min-w-[220px]">
          <div>
            <dt className="text-zinc-400">Fecha</dt>
            <dd className="font-medium text-zinc-800">{fechaInicial}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Hora</dt>
            <dd className="font-medium tabular-nums text-zinc-800">
              {horaActual}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-400">Última actualización</dt>
            <dd className="font-medium text-zinc-800">{ultimaActualizacion}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
