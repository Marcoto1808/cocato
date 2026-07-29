"use client";

import { useEffect, useState } from "react";
import { type UnidadCapturaPedido } from "@/lib/pedido-unidades";
import { mostrarCantidadSolicitada } from "@/lib/pedido-cantidad";
import SelectorModoCaptura from "@/components/pedidos/SelectorModoCaptura";

type Props = {
  cantidad: number;
  cantidadTexto?: string | null;
  unidad: string;
  onCantidadChange: (valor: string) => void;
  onUnidadChange: (unidad: string) => void;
  disabled?: boolean;
  onBlur?: () => void;
  lectura?: boolean;
};

function valorDesdeProps(
  cantidad: number,
  cantidadTexto: string | null | undefined
): string {
  if (cantidadTexto?.trim()) {
    return cantidadTexto.trim();
  }

  if (cantidad > 0) {
    return String(cantidad);
  }

  return "";
}

export default function CantidadConUnidad({
  cantidad,
  cantidadTexto = null,
  unidad,
  onCantidadChange,
  onUnidadChange,
  disabled = false,
  onBlur,
  lectura = false,
}: Props) {
  const valorProp = valorDesdeProps(cantidad, cantidadTexto);
  const [valor, setValor] = useState(valorProp);

  useEffect(() => {
    setValor(valorProp);
  }, [valorProp]);

  if (lectura) {
    return (
      <span className="text-sm text-zinc-700">
        {mostrarCantidadSolicitada(cantidad, cantidadTexto, unidad)}
      </span>
    );
  }

  function cambiarModo(modo: UnidadCapturaPedido) {
    onUnidadChange(modo);
    onBlur?.();
  }

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        inputMode="text"
        value={valor}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          setValor(next);
          onCantidadChange(next);
        }}
        onBlur={onBlur}
        aria-label={unidad === "kg" ? "Cantidad en kg" : "Cantidad en piezas"}
        placeholder={unidad === "kg" ? "Ej. 5 o medio kilo" : "Ej. 3 o 2 piezas"}
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
