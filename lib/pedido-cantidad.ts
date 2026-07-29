import { redondearMoneda } from "@/lib/pedido-calculo";

export type CantidadCapturada =
  | { tipo: "numerica"; cantidad: number }
  | { tipo: "importe"; importe: number; cantidad_texto: string }
  | { tipo: "texto"; cantidad_texto: string };

export function esCantidadImporte(
  cantidadTexto: string | null | undefined
): boolean {
  if (!cantidadTexto?.trim()) {
    return false;
  }

  const valor = cantidadTexto.trim().toLowerCase();
  return valor.includes("pesos") || valor.includes("$");
}

export function importeFijoDesdeCantidad(
  cantidadTexto: string | null | undefined
): number | null {
  if (!esCantidadImporte(cantidadTexto)) {
    return null;
  }

  const match = cantidadTexto!.trim().match(/(\d[\d,]*(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const valor = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(valor) || valor <= 0) {
    return null;
  }

  return redondearMoneda(valor);
}

export function parsearCantidadCaptura(valor: string): CantidadCapturada | null {
  const trimmed = valor.trim();

  if (!trimmed) {
    return null;
  }

  const normalizado = trimmed.replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(normalizado)) {
    const cantidad = Number(normalizado);

    if (Number.isFinite(cantidad) && cantidad > 0) {
      return { tipo: "numerica", cantidad };
    }

    return null;
  }

  if (esCantidadImporte(trimmed)) {
    const importe = importeFijoDesdeCantidad(trimmed);
    if (importe !== null) {
      return { tipo: "importe", importe, cantidad_texto: trimmed };
    }
  }

  return { tipo: "texto", cantidad_texto: trimmed };
}

export function esCantidadTexto(
  cantidadTexto: string | null | undefined
): boolean {
  return Boolean(cantidadTexto?.trim()) && !esCantidadImporte(cantidadTexto);
}

export function valorCantidadEnCampo(
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

export function mostrarCantidadSolicitada(
  cantidad: number,
  cantidadTexto: string | null | undefined,
  unidad: string
): string {
  if (cantidadTexto?.trim()) {
    return cantidadTexto.trim();
  }

  if (unidad === "kg") {
    return `${cantidad} kg`;
  }

  return `${cantidad} ${cantidad === 1 ? "pieza" : "piezas"}`;
}

export function cantidadNumericaParaCalculo(
  cantidad: number,
  cantidadTexto: string | null | undefined
): number {
  if (cantidadTexto?.trim()) {
    return 0;
  }

  return cantidad;
}

export function cantidadSolicitadaParaGuardar(
  parsed: CantidadCapturada
): number {
  return parsed.tipo === "numerica" ? parsed.cantidad : 1;
}

export function cantidadTextoParaGuardar(
  parsed: CantidadCapturada
): string | null {
  return parsed.tipo === "texto" || parsed.tipo === "importe"
    ? parsed.cantidad_texto
    : null;
}

export function lineaTieneCantidadValida(
  cantidad: number,
  cantidadTexto: string | null | undefined
): boolean {
  if (cantidadTexto?.trim()) {
    return true;
  }

  return cantidad > 0;
}
