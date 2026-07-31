import {
  iconoOrigenPedido,
  resolverOrigenPedido,
  type OrigenPedidoColumna,
} from "@/lib/pedido-origen";

type Props = {
  origen?: string | null;
  mensaje_original?: string | null;
  cliente_nombre_temporal?: string | null;
  className?: string;
};

export default function OrigenPedidoBadge({
  origen,
  mensaje_original,
  cliente_nombre_temporal,
  className = "",
}: Props) {
  const origenResuelto = resolverOrigenPedido({
    origen,
    mensaje_original,
    cliente_nombre_temporal,
  });

  if (origenResuelto === "rapido") {
    return null;
  }

  const columna = origenResuelto as OrigenPedidoColumna;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs text-zinc-500 ${className}`}
      title={columna === "whatsapp" ? "Pedido por WhatsApp" : "Pedido manual"}
    >
      <span aria-hidden>{iconoOrigenPedido(columna)}</span>
      <span>{columna === "whatsapp" ? "WhatsApp" : "Manual"}</span>
    </span>
  );
}
