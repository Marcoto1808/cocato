import { normalizarTextoPedido } from "./cantidad-natural.ts";

const ALIAS_POR_CATEGORIA: Record<string, string[]> = {
  Cerdo: ["cerdo", "puerco", "cochino", "chancho", "carne de puerco"],
  Res: ["res", "carne de res", "vaca", "bovino"],
};

function parsearIndiceNumerico(mensaje: string, max: number): number | null {
  const match = mensaje.trim().match(/^(\d+)/);
  if (!match) return null;

  const indice = Number(match[1]);
  if (!Number.isFinite(indice) || indice < 1 || indice > max) return null;
  return indice;
}

export function resolverSeleccionCategoria(
  mensaje: string,
  categorias: string[]
): number | null {
  if (categorias.length === 0) return null;

  const porNumero = parsearIndiceNumerico(mensaje, categorias.length);
  if (porNumero) return porNumero;

  const normalizado = normalizarTextoPedido(mensaje);
  if (!normalizado) return null;

  for (let indice = 0; indice < categorias.length; indice++) {
    const categoria = categorias[indice];
    const categoriaNorm = normalizarTextoPedido(categoria);

    if (normalizado === categoriaNorm) return indice + 1;

    const aliases = ALIAS_POR_CATEGORIA[categoria] ?? [];
    if (aliases.some((alias) => normalizado === alias)) return indice + 1;
  }

  return null;
}
