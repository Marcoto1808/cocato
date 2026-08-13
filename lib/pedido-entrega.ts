export type DireccionEntregaPedido =
  | { tipo: "domicilio"; direccion: string }
  | { tipo: "recoger" }
  | { tipo: "no_registrada" };

const PATRONES_DOMICILIO = [
  /^Env[ií]o a domicilio \(direcci[oó]n registrada\):\s*(.+)$/i,
  /^Env[ií]o a domicilio:\s*(.+)$/i,
];

const PATRON_RECOGER = /^Entrega:\s*cliente pasa a recoger$/i;

/** Dirección de entrega anotada en el pedido (WhatsApp → pedidos.observaciones). */
export function resolverDireccionEntregaPedido(
  observaciones: string | null | undefined
): DireccionEntregaPedido {
  const texto = observaciones?.trim();
  if (!texto) return { tipo: "no_registrada" };

  for (const linea of texto.split("\n")) {
    const limpia = linea.trim();
    if (!limpia) continue;

    if (PATRON_RECOGER.test(limpia)) {
      return { tipo: "recoger" };
    }

    for (const patron of PATRONES_DOMICILIO) {
      const coincidencia = limpia.match(patron);
      const direccion = coincidencia?.[1]?.trim();
      if (direccion) {
        return { tipo: "domicilio", direccion };
      }
    }
  }

  return { tipo: "no_registrada" };
}

export function etiquetaDireccionEntregaPedido(
  entrega: DireccionEntregaPedido
): string {
  if (entrega.tipo === "domicilio") return entrega.direccion;
  if (entrega.tipo === "recoger") return "Cliente pasa a recoger";
  return "No registrada";
}
