"use client";

import {
  UNIDADES_CAPTURA_PEDIDO,
  type UnidadCapturaPedido,
} from "@/lib/pedido-unidades";

const ETIQUETAS_TOGGLE: Record<UnidadCapturaPedido, string> = {
  kg: "KG",
  pieza: "PIEZA",
};

type Props = {
  value: UnidadCapturaPedido;
  onChange: (value: UnidadCapturaPedido) => void;
  disabled?: boolean;
  compacto?: boolean;
  grande?: boolean;
};

export default function SelectorModoCaptura({
  value,
  onChange,
  disabled = false,
  compacto = false,
  grande = false,
}: Props) {
  return (
    <div className="flex gap-2" role="group" aria-label="Modo de captura">
      {UNIDADES_CAPTURA_PEDIDO.map((modo) => {
        const activo = value === modo;

        return (
          <button
            key={modo}
            type="button"
            disabled={disabled}
            onClick={() => onChange(modo)}
            className={`rounded-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              grande
                ? "min-h-[3.25rem] min-w-[5.5rem] px-6 py-3.5 text-base"
                : compacto
                  ? "px-3 py-1.5 text-xs"
                  : "px-5 py-2.5 text-sm"
            } ${
              activo
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {ETIQUETAS_TOGGLE[modo]}
          </button>
        );
      })}
    </div>
  );
}
