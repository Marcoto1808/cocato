import {
  extraerProductoTextoCliente,
  limpiarPrefijoPedido,
  normalizarTextoPedido,
} from "@/lib/interpretacion/cantidad-natural";
import {
  normalizarNombreProducto,
  normalizarPluralesComerciales,
  productosPorEspecificidad,
  resolverProductoEnCatalogo,
  separarCantidadInicial,
  variantesNombreProducto,
} from "@/lib/interpretacion/resolver-producto";
import type { ProductoCatalogo } from "@/lib/interpretacion/mensaje-interpreter";
import { esOpcionConfirmacionPedido } from "@/lib/whatsapp/comandos-pedido";
import { mensajeContieneTextoProducto } from "@/lib/whatsapp/pedido-guiado-cantidad";

export type ProductoGuiadoSlot = {
  etiqueta: string;
  /** Producto del catálogo cuando la selección es directa. */
  productoId?: string;
  /** Texto para interpretar al capturar cantidad (bistec, molida, etc.). */
  textoPedido?: string;
};

export type ProductoMenuGuiado = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
};

/** Menú guiado para cocinas, restaurantes y fondas. */
const LISTA_COCINA_RESTAURANTE_FONDA: Array<{
  etiqueta: string;
  buscar: string[];
  categoriaPreferida?: string;
  interpretar?: boolean;
}> = [
  { etiqueta: "Bistec", buscar: ["bistec"], interpretar: true },
  { etiqueta: "Molida", buscar: ["molida"], interpretar: true },
  { etiqueta: "Maciza", buscar: ["maciza", "pulpa maciza"], interpretar: true },
  { etiqueta: "Costilla", buscar: ["costilla"], categoriaPreferida: "Cerdo" },
  { etiqueta: "Chuleta fresca", buscar: ["chuleta natural", "chuleta"], categoriaPreferida: "Cerdo" },
  { etiqueta: "Milanesa", buscar: ["milanesa"], categoriaPreferida: "Cerdo" },
  { etiqueta: "Chuleta ahumada", buscar: ["chuleta ahumada"] },
  { etiqueta: "Espinazo", buscar: ["espinazo"], categoriaPreferida: "Cerdo" },
  { etiqueta: "Codillo", buscar: ["codillo"], categoriaPreferida: "Cerdo" },
  { etiqueta: "Cabeza", buscar: ["cabeza"], categoriaPreferida: "Cerdo" },
  { etiqueta: "Manitas", buscar: ["manitas"], categoriaPreferida: "Cerdo" },
];

const LISTA_CARNICERIA: Array<{
  etiqueta: string;
  buscar: string[];
  categoriaPreferida?: string;
  interpretar?: boolean;
}> = [
  { etiqueta: "Capote", buscar: ["capote"], categoriaPreferida: "Cerdo" },
  { etiqueta: "Pierna", buscar: ["pierna"], categoriaPreferida: "Cerdo" },
  { etiqueta: "Costilla", buscar: ["costilla"], categoriaPreferida: "Cerdo" },
  { etiqueta: "Pulpa", buscar: ["pulpa", "pulpa blanca", "pulpa negra"], interpretar: true },
  { etiqueta: "Espaldilla", buscar: ["espaldilla"], categoriaPreferida: "Cerdo" },
  { etiqueta: "Espinazo", buscar: ["espinazo"], categoriaPreferida: "Cerdo" },
  { etiqueta: "Pecho", buscar: ["pecho"] },
  { etiqueta: "Jamón", buscar: ["jamon", "jamón"] },
  { etiqueta: "Cabeza", buscar: ["cabeza"], categoriaPreferida: "Cerdo" },
];

function normalizarNombre(valor: string): string {
  return normalizarTextoPedido(valor);
}

function coincideProducto(
  producto: ProductoMenuGuiado,
  termino: string,
  categoriaPreferida?: string
): boolean {
  const nombre = normalizarNombre(producto.nombre);
  const buscado = normalizarNombre(termino);

  if (categoriaPreferida && producto.categoria !== categoriaPreferida) {
    return false;
  }

  return (
    nombre === buscado ||
    nombre.startsWith(`${buscado} `) ||
    buscado.startsWith(`${nombre} `)
  );
}

function resolverProductoDirecto(
  productos: ProductoMenuGuiado[],
  buscar: string[],
  categoriaPreferida?: string
): ProductoMenuGuiado | null {
  for (const termino of buscar) {
    const exactos = productos.filter((producto) =>
      coincideProducto(producto, termino, categoriaPreferida)
    );
    if (exactos.length === 1) return exactos[0];

    if (exactos.length > 1 && categoriaPreferida) {
      const preferido = exactos.find(
        (producto) => producto.categoria === categoriaPreferida
      );
      if (preferido) return preferido;
    }

    if (exactos.length > 1) {
      return exactos[0];
    }
  }

  return null;
}

function slotsDesdeLista(
  lista: typeof LISTA_COCINA_RESTAURANTE_FONDA,
  productos: ProductoMenuGuiado[],
  especiePreferida?: "Res" | "Cerdo"
): ProductoGuiadoSlot[] {
  const slots: ProductoGuiadoSlot[] = [];

  for (const item of lista) {
    if (item.interpretar) {
      slots.push({
        etiqueta: item.etiqueta,
        textoPedido: item.buscar[0],
      });
      continue;
    }

    const categoriaPreferida =
      item.categoriaPreferida ?? especiePreferida;

    const producto = resolverProductoDirecto(
      productos,
      item.buscar,
      categoriaPreferida
    );
    if (!producto) continue;

    slots.push({
      etiqueta: item.etiqueta,
      productoId: producto.id,
    });
  }

  return slots;
}

/** Determina la lista guiada según el código del tipo de cliente. */
/** Cocina, restaurante y fonda comparten el mismo menú guiado. */
export function codigoTipoClienteEsRestauranteOFonda(codigo: string | null): boolean {
  return usaMenuCocinaRestauranteFonda({ codigo });
}

export function codigoTipoClienteEsCocina(codigo: string | null): boolean {
  return normalizarNombre(codigo ?? "") === "cocina";
}

export function codigoTipoClienteEsCarniceria(codigo: string | null): boolean {
  return usaMenuCarniceria({ codigo });
}

export type TipoClienteParaMenu = {
  codigo?: string | null;
  nombre?: string | null;
};

function textoNormalizadoTipo(valor: string | null | undefined): string {
  return normalizarNombre(valor ?? "");
}

/** Prioriza fonda/restaurante/cocina sobre un código mal asignado. */
export function usaMenuCocinaRestauranteFonda(
  tipo: TipoClienteParaMenu
): boolean {
  const codigo = textoNormalizadoTipo(tipo.codigo);
  const nombre = textoNormalizadoTipo(tipo.nombre);

  return (
    codigo === "fonda" ||
    codigo === "restaurante" ||
    codigo === "cocina" ||
    nombre.includes("fonda") ||
    nombre.includes("restaurante") ||
    nombre.includes("cocina")
  );
}

export function usaMenuCarniceria(tipo: TipoClienteParaMenu): boolean {
  if (usaMenuCocinaRestauranteFonda(tipo)) {
    return false;
  }

  const codigo = textoNormalizadoTipo(tipo.codigo);
  const nombre = textoNormalizadoTipo(tipo.nombre);

  return codigo === "carniceria" || nombre.includes("carniceria");
}

export function construirSlotsPedidoGuiado(
  tipoCliente: string | null | TipoClienteParaMenu,
  productos: ProductoMenuGuiado[],
  especiePreferida?: "Res" | "Cerdo"
): ProductoGuiadoSlot[] {
  const tipo: TipoClienteParaMenu =
    typeof tipoCliente === "string" || tipoCliente === null
      ? { codigo: tipoCliente }
      : tipoCliente;

  const lista = usaMenuCarniceria(tipo)
    ? LISTA_CARNICERIA
    : LISTA_COCINA_RESTAURANTE_FONDA;

  return slotsDesdeLista(lista, productos, especiePreferida);
}

export function productosMenuDesdeSlots(
  slots: ProductoGuiadoSlot[],
  productos: ProductoMenuGuiado[]
): Array<{ nombre: string }> {
  return slots.map((slot) => {
    if (slot.productoId) {
      const producto = productos.find((item) => item.id === slot.productoId);
      return { nombre: slot.etiqueta || producto?.nombre || slot.productoId };
    }
    return { nombre: slot.etiqueta };
  });
}

function nombreCatalogoCoincideConTextoCliente(
  nombreReferencia: string,
  textoClienteNorm: string
): boolean {
  const referenciaNorm = normalizarNombreProducto(nombreReferencia);
  if (!referenciaNorm) return false;

  if (textoClienteNorm === referenciaNorm) return true;
  if (textoClienteNorm.startsWith(`${referenciaNorm} `)) return true;
  if (referenciaNorm.startsWith(`${textoClienteNorm} `)) return true;

  const tokensCliente = textoClienteNorm.split(/\s+/).filter(Boolean);
  const tokensReferencia = referenciaNorm.split(/\s+/).filter(Boolean);

  if (
    tokensReferencia.length > 0 &&
    tokensCliente.length > 0 &&
    tokensCliente[0] === tokensReferencia[0]
  ) {
    return true;
  }

  return tokensCliente.includes(referenciaNorm);
}

export function extraerTextoProductoParaValidacionLibre(textoCliente: string): string {
  const texto = textoCliente.trim();
  if (!texto) return texto;

  const limpio = limpiarPrefijoPedido(texto);
  const producto = extraerProductoTextoCliente(limpio).trim();
  if (producto) return producto;

  const separado = separarCantidadInicial(limpio);
  if (separado?.resto?.trim()) return separado.resto.trim();

  return texto;
}

function resolverProductoTextoLibreContraCatalogo(
  texto: string,
  productos: ProductoMenuGuiado[]
): ProductoCatalogo | null {
  const catalogo = productos as ProductoCatalogo[];
  const resolucion = resolverProductoEnCatalogo(texto, catalogo);
  if (resolucion.tipo === "ok") return resolucion.producto;

  const textoNorm = normalizarPluralesComerciales(texto);

  for (const producto of productosPorEspecificidad(catalogo)) {
    if (nombreCatalogoCoincideConTextoCliente(producto.nombre, textoNorm)) {
      return producto;
    }

    for (const variante of variantesNombreProducto(producto.nombre)) {
      if (nombreCatalogoCoincideConTextoCliente(variante, textoNorm)) {
        return producto;
      }
    }

    for (const alias of producto.aliases ?? []) {
      if (nombreCatalogoCoincideConTextoCliente(alias, textoNorm)) {
        return producto;
      }
    }
  }

  return null;
}

function validarTextoLibreContraCatalogo(
  texto: string,
  productos: ProductoMenuGuiado[]
): boolean {
  return resolverProductoTextoLibreContraCatalogo(texto, productos) !== null;
}

/** Resuelve el producto de catálogo usando la misma lógica que valida texto libre al capturar. */
export function resolverProductoTextoLibrePedidoGuiado(
  textoCliente: string,
  productos: ProductoMenuGuiado[]
): ProductoCatalogo | null {
  const texto = textoCliente.trim();
  if (!texto || texto.length < 2) return null;

  const candidatos = new Set<string>([
    texto,
    extraerTextoProductoParaValidacionLibre(texto),
  ]);

  for (const candidato of candidatos) {
    if (candidato.length >= 2) {
      const producto = resolverProductoTextoLibreContraCatalogo(candidato, productos);
      if (producto) return producto;
    }
  }

  return null;
}

/** Valida que el texto libre del cliente refiera a un producto real del catálogo. */
export function validarTextoLibrePedidoGuiado(
  textoCliente: string,
  productos: ProductoMenuGuiado[]
): boolean {
  const texto = textoCliente.trim();
  if (!texto || texto.length < 2) return false;

  const candidatos = new Set<string>([
    texto,
    extraerTextoProductoParaValidacionLibre(texto),
  ]);

  for (const candidato of candidatos) {
    if (candidato.length >= 2 && validarTextoLibreContraCatalogo(candidato, productos)) {
      return true;
    }
  }

  return false;
}

export function esTextoLibreProductoPedido(texto: string): boolean {
  if (!mensajeContieneTextoProducto(texto)) return false;
  if (esOpcionConfirmacionPedido(texto)) return false;
  return true;
}

export function construirSlotTextoLibrePedidoGuiado(
  textoCliente: string
): ProductoGuiadoSlot {
  const texto = textoCliente.trim();
  return {
    etiqueta: texto,
    textoPedido: texto,
  };
}

export function construirMensajeProductoLibreNoEncontrado(): string {
  return [
    "No encontré un producto parecido a eso en nuestro catálogo.",
    "Escriba el nombre del producto o elija un número del menú.",
  ].join("\n");
}
