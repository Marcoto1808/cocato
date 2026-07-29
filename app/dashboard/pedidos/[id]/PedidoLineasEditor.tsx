"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  calcularTotalLineas,
  esPesoTotalEditable,
  formatMoneda,
  mostrarSubtotalLinea,
  normalizarPrecioAplicado,
} from "@/lib/pedido-calculo";
import CantidadConUnidad from "@/components/pedidos/CantidadConUnidad";
import {
  normalizarLineaPedido,
  recalcularLineaPedido,
  type LineaPedidoEditable,
} from "@/lib/pedido-lineas";

export type { LineaPedidoEditable } from "@/lib/pedido-lineas";

type Props = {
  pedidoId: string;
  lineasIniciales: LineaPedidoEditable[];
  soloLectura?: boolean;
};

export default function PedidoLineasEditor({
  pedidoId,
  lineasIniciales,
  soloLectura = false,
}: Props) {
  const router = useRouter();
  const [lineas, setLineas] = useState(() =>
    lineasIniciales.map(normalizarLineaPedido)
  );
  const lineasRef = useRef(lineas);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lineasRef.current = lineas;
  }, [lineas]);

  const total = useMemo(() => calcularTotalLineas(lineas), [lineas]);

  async function sincronizarTotalPedido(nuevoTotal: number) {
    await supabase
      .from("pedidos")
      .update({ total: nuevoTotal })
      .eq("id", pedidoId);
  }

  async function persistirLinea(
    linea: LineaPedidoEditable,
    nuevasLineas: LineaPedidoEditable[]
  ) {
    setGuardando(linea.id);
    setError(null);

    const { error: updateError } = await supabase
      .from("detalle_pedido")
      .update({
        cantidad_solicitada: linea.cantidad_solicitada,
        unidad: linea.unidad,
        peso_real: linea.peso_real,
        precio_aplicado: linea.precio_aplicado,
        precio_modificado: linea.precio_modificado,
        subtotal: linea.subtotal,
      })
      .eq("id", linea.id);

    if (updateError) {
      setError("No se pudo guardar los cambios de la línea.");
      setGuardando(null);
      return;
    }

    const nuevoTotal = calcularTotalLineas(nuevasLineas);
    await sincronizarTotalPedido(nuevoTotal);
    setGuardando(null);
    router.refresh();
  }

  function actualizarLineaLocal(
    id: string,
    cambios: Partial<LineaPedidoEditable>
  ) {
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

        if ("unidad" in cambios && cambios.unidad === "kg") {
          actualizada.peso_real = null;
        }

        return recalcularLineaPedido(actualizada);
      })
    );
  }

  async function guardarLinea(id: string) {
    const linea = lineasRef.current.find((item) => item.id === id);
    if (!linea) return;
    await persistirLinea(linea, lineasRef.current);
  }

  async function eliminarLinea(id: string) {
    setGuardando(id);
    setError(null);

    const { error: deleteError } = await supabase
      .from("detalle_pedido")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError("No se pudo eliminar el producto.");
      setGuardando(null);
      return;
    }

    const nuevasLineas = lineas.filter((linea) => linea.id !== id);
    setLineas(nuevasLineas);
    await sincronizarTotalPedido(calcularTotalLineas(nuevasLineas));
    setGuardando(null);
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
    <>
      {error ? (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px]">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th className="pb-3 pr-3">Producto</th>
              <th className="pb-3 pr-3">Cantidad</th>
              <th className="pb-3 pr-3">Precio de lista</th>
              <th className="pb-3 pr-3">Precio aplicado</th>
              <th className="pb-3 pr-3">Peso total (kg)</th>
              <th className="pb-3 pr-3">Subtotal</th>
              {!soloLectura ? <th className="pb-3">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {lineas.map((linea) => {
              const subtotalTexto = mostrarSubtotalLinea(
                linea.unidad,
                linea.subtotal,
                linea.peso_real
              );
              const procesando = guardando === linea.id;

              return (
                <tr key={linea.id} className="border-b border-zinc-100">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-zinc-900">{linea.nombre}</p>
                  </td>
                  <td className="py-3 pr-3">
                    <CantidadConUnidad
                      cantidad={linea.cantidad_solicitada}
                      unidad={linea.unidad}
                      disabled={procesando}
                      lectura={soloLectura}
                      onCantidadChange={(cantidad) =>
                        actualizarLineaLocal(linea.id, {
                          cantidad_solicitada: cantidad,
                        })
                      }
                      onUnidadChange={(unidad) =>
                        actualizarLineaLocal(linea.id, { unidad })
                      }
                      onBlur={() => guardarLinea(linea.id)}
                    />
                  </td>
                  <td className="py-3 pr-3 text-sm text-zinc-600">
                    {formatMoneda(linea.precio_lista)}
                  </td>
                  <td className="py-3 pr-3">
                    {soloLectura ? (
                      <span className="text-sm text-zinc-700">
                        {formatMoneda(linea.precio_aplicado)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        value={linea.precio_aplicado}
                        disabled={procesando}
                        onChange={(event) =>
                          actualizarLineaLocal(linea.id, {
                            precio_aplicado: normalizarPrecioAplicado(
                              Number(event.target.value)
                            ),
                          })
                        }
                        onBlur={() => guardarLinea(linea.id)}
                        className={`w-28 rounded-lg border px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-60 ${
                          linea.precio_modificado
                            ? "border-amber-300 bg-amber-50"
                            : "border-zinc-300"
                        }`}
                      />
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {esPesoTotalEditable(linea.unidad) ? (
                      soloLectura ? (
                        <span className="text-sm text-zinc-700">
                          {linea.peso_real !== null
                            ? `${linea.peso_real} kg`
                            : "—"}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          placeholder="kg"
                          value={linea.peso_real ?? ""}
                          disabled={procesando}
                          onChange={(event) => {
                            const valor = event.target.value;
                            actualizarLineaLocal(linea.id, {
                              peso_real:
                                valor === "" ? null : Number(valor),
                            });
                          }}
                          onBlur={() => guardarLinea(linea.id)}
                          className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-60"
                        />
                      )
                    ) : (
                      <span className="text-sm text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-sm font-medium text-zinc-900">
                    {subtotalTexto ? (
                      subtotalTexto
                    ) : (
                      <span className="text-zinc-400">Pendiente</span>
                    )}
                  </td>
                  {!soloLectura ? (
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => eliminarLinea(linea.id)}
                        disabled={guardando !== null}
                        className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-4 mt-6 rounded-xl bg-zinc-900 px-6 py-4 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-300">Total del pedido</p>
            <p className="text-3xl font-bold">{formatMoneda(total)}</p>
            <p className="text-xs text-zinc-400">
              {lineas.length} producto{lineas.length === 1 ? "" : "s"}
              {guardando ? " · Guardando..." : ""}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
