"use client";

import {
  minCantidadPorUnidad,
  pasoCantidadPorUnidad,
  type UnidadCapturaPedido,
} from "@/lib/pedido-unidades";
import SelectorModoCaptura from "@/components/pedidos/SelectorModoCaptura";

type Props = {
  cantidad: number;
  unidad: string;
  onCantidadChange: (cantidad: number) => void;
  onUnidadChange: (unidad: string) => void;
  disabled?: boolean;
  onBlur?: () => void;
  lectura?: boolean;
};

export default function CantidadConUnidad({
  cantidad,
  unidad,
  onCantidadChange,
  onUnidadChange,
  disabled = false,
  onBlur,
  lectura = false,
}: Props) {
  if (lectura) {
    const etiqueta =
      unidad === "kg"
        ? `${cantidad} kg`
        : `${cantidad} pieza${cantidad === 1 ? "" : "s"}`;
    return <span className="text-sm text-zinc-700">{etiqueta}</span>;
  }

  function cambiarModo(modo: UnidadCapturaPedido) {
    onUnidadChange(modo);
    onBlur?.();
  }

  return (
    <div className="space-y-1.5">
      <input
        type="number"
        min={minCantidadPorUnidad(unidad)}
        step={pasoCantidadPorUnidad(unidad)}
        value={cantidad}
        disabled={disabled}
        onChange={(event) => onCantidadChange(Number(event.target.value))}
        onBlur={onBlur}
        aria-label={unidad === "kg" ? "Cantidad en kg" : "Cantidad en piezas"}
        className="w-20 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-60"
      />
      <SelectorModoCaptura
        value={unidad as UnidadCapturaPedido}
        onChange={cambiarModo}
        disabled={disabled}
        compacto
      />
    </div>
  );
}
