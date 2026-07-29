"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  formatMoneda,
  normalizarPrecioAplicado,
  redondearMoneda,
} from "@/lib/pedido-calculo";
import {
  normalizarLineaPedido,
  type LineaPedidoEditable,
} from "@/lib/pedido-lineas";
import {
  mostrarCantidadSolicitada,
  importeFijoDesdeCantidad,
} from "@/lib/pedido-cantidad";
import {
  calcularSubtotalPreparacion,
  formatearCantidadSolicitada,
  lineaPreparada,
} from "@/lib/pedido-preparacion";
import { PedidoMarcarListo } from "./PedidoEstadoActions";

export type { LineaPedidoEditable } from "@/lib/pedido-lineas";

type Props = {
  pedidoId: string;
  lineasIniciales: LineaPedidoEditable[];
  soloLectura?: boolean;
};

function recalcularLineaPreparacion(
  linea: LineaPedidoEditable
): LineaPedidoEditable {
  const importeFijo = importeFijoDesdeCantidad(linea.cantidad_texto);

  if (importeFijo !== null) {
    return {
      ...linea,
      subtotal: importeFijo,
    };
  }

  return {
    ...linea,
    subtotal: calcularSubtotalPreparacion(linea.peso_real, linea.precio_aplicado),
  };
}

export default function PedidoLineasEditor({
  pedidoId,
  lineasIniciales,
  soloLectura = false,
}: Props) {
  const router = useRouter();
  const [lineas, setLineas] = useState(() =>
    lineasIniciales.map(normalizarLineaPedido).map(recalcularLineaPreparacion)
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);

  const subtotal = useMemo(
    () =>
      redondearMoneda(
        lineas.reduce((total, linea) => total + linea.subtotal, 0)
      ),
    [lineas]
  );

  function actualizarLineaLocal(
    id: string,
    cambios: Partial<LineaPedidoEditable>
  ) {
    setGuardadoOk(false);
    setLineas((prev) =>
      prev.map((linea) => {
        if (linea.id !== id) return linea;

        const actualizada = { ...linea, ...cambios };

        if ("precio_aplicado" in cambios) {
          actualizada.precio_aplicado = normalizarPrecioAplicado(
            actualizada.precio_aplicado
          );
          actualizada.precio_modificado =
            actualizada.precio_aplicado !== actualizada.precio_lista;
        }

        return recalcularLineaPreparacion(actualizada);
      })
    );
  }

  async function guardarPreparacion() {
    setGuardando(true);
    setError(null);
    setGuardadoOk(false);

    for (const linea of lineas) {
      const { error: updateError } = await supabase
        .from("detalle_pedido")
        .update({
          peso_real: linea.peso_real,
          precio_aplicado: linea.precio_aplicado,
          precio_modificado: linea.precio_modificado,
          subtotal: linea.subtotal,
        })
        .eq("id", linea.id);

      if (updateError) {
        setError("No se pudo guardar la preparación.");
        setGuardando(false);
        return;
      }
    }

    const { error: pedidoError } = await supabase
      .from("pedidos")
      .update({ total: subtotal })
      .eq("id", pedidoId);

    if (pedidoError) {
      setError("No se pudo actualizar el total del pedido.");
      setGuardando(false);
      return;
    }

    setGuardando(false);
    setGuardadoOk(true);
    router.refresh();
  }

  if (lineas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
        Este pedido no tiene productos registrados.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      {guardadoOk ? (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          Preparación guardada
        </div>
      ) : null}

      <ul className="space-y-4">
        {lineas.map((linea) => {
          const preparada = lineaPreparada(linea.peso_real, linea.precio_aplicado);
          const checklist = formatearCantidadSolicitada(
            linea.cantidad_solicitada,
            linea.unidad,
            linea.nombre,
            linea.cantidad_texto
          );

          return (
            <li
              key={linea.id}
              className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 text-xl leading-none"
                  aria-hidden="true"
                >
                  {preparada ? "✅" : "⬜"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-zinc-900">
                    {checklist}
                  </p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        Solicitado
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-700">
                        {mostrarCantidadSolicitada(
                          linea.cantidad_solicitada,
                          linea.cantidad_texto,
                          linea.unidad
                        )}
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor={`peso-${linea.id}`}
                        className="text-xs font-medium uppercase tracking-wide text-zinc-400"
                      >
                        Peso real (kg)
                      </label>
                      {soloLectura ? (
                        <p className="mt-0.5 text-sm text-zinc-700">
                          {linea.peso_real !== null ? `${linea.peso_real} kg` : "—"}
                        </p>
                      ) : (
                        <input
                          id={`peso-${linea.id}`}
                          type="number"
                          min="0"
                          step="0.001"
                          inputMode="decimal"
                          placeholder="0.000"
                          value={linea.peso_real ?? ""}
                          disabled={guardando}
                          onChange={(event) => {
                            const valor = event.target.value;
                            actualizarLineaLocal(linea.id, {
                              peso_real:
                                valor === "" ? null : Number(valor),
                            });
                          }}
                          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 disabled:opacity-60"
                        />
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor={`precio-${linea.id}`}
                        className="text-xs font-medium uppercase tracking-wide text-zinc-400"
                      >
                        Precio aplicado
                      </label>
                      {soloLectura ? (
                        <p className="mt-0.5 text-sm text-zinc-700">
                          {formatMoneda(linea.precio_aplicado)}
                        </p>
                      ) : (
                        <input
                          id={`precio-${linea.id}`}
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          value={linea.precio_aplicado}
                          disabled={guardando}
                          onChange={(event) =>
                            actualizarLineaLocal(linea.id, {
                              precio_aplicado: normalizarPrecioAplicado(
                                Number(event.target.value)
                              ),
                            })
                          }
                          className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-base text-zinc-900 disabled:opacity-60 ${
                            linea.precio_modificado
                              ? "border-amber-300 bg-amber-50"
                              : "border-zinc-300"
                          }`}
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-zinc-200 pt-3">
                      <span className="text-sm font-medium text-zinc-500">
                        Total
                      </span>
                      <span className="text-lg font-bold tabular-nums text-zinc-900">
                        {linea.subtotal > 0
                          ? formatMoneda(linea.subtotal)
                          : "$—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">Subtotal</span>
          <span className="font-semibold tabular-nums text-zinc-900">
            {formatMoneda(subtotal)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2">
          <span className="text-base font-semibold text-zinc-900">
            Total del pedido
          </span>
          <span className="text-2xl font-bold tabular-nums text-zinc-900">
            {formatMoneda(subtotal)}
          </span>
        </div>
      </div>

      {!soloLectura ? (
        <div className="space-y-3 pb-4">
          <button
            type="button"
            onClick={guardarPreparacion}
            disabled={guardando}
            className="w-full rounded-xl bg-zinc-900 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando ? "Guardando..." : "Guardar preparación"}
          </button>
          <PedidoMarcarListo />
        </div>
      ) : null}
    </div>
  );
}
