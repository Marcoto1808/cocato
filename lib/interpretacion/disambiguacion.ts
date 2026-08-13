import type { LineaInterpretada, ProductoCatalogo } from "@/lib/interpretacion/mensaje-interpreter";
import {
  normalizarCantidadTextoParaDisplay,
  normalizarTextoPedido,
  extraerProductoTextoCliente,
  inferirUnidadExplicitaDesdeSegmento,
} from "@/lib/interpretacion/cantidad-natural";
import { PRODUCTO_PENDIENTE_DISAMBIGUACION_ID } from "@/lib/interpretacion/linea-libre";
import { resolverSeleccionCategoria } from "@/lib/interpretacion/resolver-categoria";
import {
  normalizarNombreProducto,
  normalizarPluralesComerciales,
  nombresEquivalentes,
} from "@/lib/interpretacion/resolver-producto";

export type OpcionDisambiguacion = {
  id: string;
  nombre: string;
  categoria?: string;
};

export type DisambiguacionPendiente = {
  segmento: string;
  cantidad: number;
  cantidadTexto: string;
  unidad: "kg" | "pieza" | null;
  opciones: OpcionDisambiguacion[];
  productoBuscado?: string;
  mensajeOriginal?: string;
  cola?: DisambiguacionPendiente[];
};

export type ContinuarDisambiguacionResult =
  | { ok: false; respuestaInvalida: string }
  | {
      ok: true;
      linea: LineaInterpretada;
      productoNombre: string;
      siguiente: DisambiguacionPendiente | null;
      aclaracion?: string;
    };

function categoriasEnOrden(opciones: OpcionDisambiguacion[]): string[] {
  const vistos = new Set<string>();
  const categorias: string[] = [];
  for (const opcion of opciones) {
    const categoria = opcion.categoria?.trim();
    if (!categoria || vistos.has(categoria)) continue;
    vistos.add(categoria);
    categorias.push(categoria);
  }
  return categorias;
}

const ESPECIE_ESPECIFICADA =
  /\b(de\s+)?(res|cerdo|puerco|cochino|chancho|carne de res)\b/;

const CATEGORIAS_ESPECIE = ["Res", "Cerdo"] as const;

function stemProducto(buscado: string): string {
  return normalizarPluralesComerciales(buscado.trim()).split(/\s+/)[0] ?? "";
}

/** Detecta si el cliente ya indicó res o cerdo/puerco en el texto. */
export function especieYaEspecificadaEnBusqueda(buscado: string): boolean {
  return ESPECIE_ESPECIFICADA.test(normalizarTextoPedido(buscado));
}

/** Solo bistec y molida preguntan por especie cuando no está en el mensaje. */
export function requiereDisambiguacionPorEspecie(buscado: string): boolean {
  if (especieYaEspecificadaEnBusqueda(buscado)) return false;
  const stem = stemProducto(buscado);
  return stem === "bistec" || stem === "molida";
}

function filtrarOpcionesResCerdo(
  opciones: ProductoCatalogo[]
): ProductoCatalogo[] {
  const filtradas = opciones.filter((opcion) => {
    const categoria = opcion.categoria?.trim();
    return categoria === "Res" || categoria === "Cerdo";
  });

  return [...filtradas].sort((a, b) => {
    const orden = (categoria?: string) =>
      categoria === "Res" ? 0 : categoria === "Cerdo" ? 1 : 2;
    return orden(a.categoria) - orden(b.categoria);
  });
}

function elegirOpcionCerdo(
  opciones: ProductoCatalogo[]
): ProductoCatalogo | null {
  return (
    opciones.find((opcion) => opcion.categoria === "Cerdo") ??
    opciones.find((opcion) =>
      /\b(cerdo|puerco)\b/i.test(opcion.nombre)
    ) ??
    opciones[0] ??
    null
  );
}

function resolverPorEspecieExplicita(
  nombreBuscado: string,
  opciones: ProductoCatalogo[]
): ProductoCatalogo | null {
  if (!especieYaEspecificadaEnBusqueda(nombreBuscado)) return null;

  const buscadoNorm = normalizarPluralesComerciales(nombreBuscado.trim());
  for (const opcion of opciones) {
    if (nombresEquivalentes(nombreBuscado, opcion.nombre)) return opcion;

    const catalogoNorm = normalizarNombreProducto(opcion.nombre);
    if (
      catalogoNorm.startsWith(`${buscadoNorm} `) ||
      buscadoNorm.startsWith(`${catalogoNorm} `) ||
      catalogoNorm === buscadoNorm
    ) {
      return opcion;
    }
  }

  return null;
}

/** Aplica reglas de especie antes de encolar una ambigüedad. */
export function procesarResolucionAmbigua(input: {
  nombreBuscado: string;
  opciones: ProductoCatalogo[];
}):
  | { tipo: "ok"; producto: ProductoCatalogo }
  | { tipo: "ambiguo"; opciones: ProductoCatalogo[] } {
  const { nombreBuscado, opciones } = input;
  if (opciones.length === 0) {
    return { tipo: "ambiguo", opciones: [] };
  }
  if (opciones.length === 1) {
    return { tipo: "ok", producto: opciones[0] };
  }

  const porEspecie = resolverPorEspecieExplicita(nombreBuscado, opciones);
  if (porEspecie) {
    return { tipo: "ok", producto: porEspecie };
  }

  const stem = stemProducto(nombreBuscado);

  if (stem === "costilla") {
    const producto = elegirOpcionCerdo(opciones);
    if (producto) return { tipo: "ok", producto };
  }

  if (requiereDisambiguacionPorEspecie(nombreBuscado)) {
    const filtradas = filtrarOpcionesResCerdo(opciones);
    if (filtradas.length === 1) {
      return { tipo: "ok", producto: filtradas[0] };
    }
    if (filtradas.length >= 2) {
      return { tipo: "ambiguo", opciones: filtradas };
    }
  }

  const producto = elegirOpcionCerdo(opciones);
  if (producto) return { tipo: "ok", producto };

  return { tipo: "ok", producto: opciones[0] };
}

/** Disambiguación resoluble eligiendo Res o Cerdo (bistec / molida). */
export function esDisambiguacionPorEspecie(
  opciones: OpcionDisambiguacion[],
  productoBuscado?: string
): boolean {
  if (!productoBuscado?.trim() || opciones.length < 2) return false;
  if (!requiereDisambiguacionPorEspecie(productoBuscado)) return false;

  const categorias = new Set(
    opciones
      .map((opcion) => opcion.categoria?.trim())
      .filter((categoria): categoria is string => Boolean(categoria))
  );

  return (
    categorias.size >= 2 &&
    [...categorias].every(
      (categoria) => categoria === "Res" || categoria === "Cerdo"
    )
  );
}

/** Ambigüedad resoluble solo eligiendo categoría (p. ej. Costilla Cerdo vs Costilla Res). */
export function esAmbiguedadPorCategoria(
  opciones: OpcionDisambiguacion[],
  productoBuscado?: string
): boolean {
  if (opciones.length < 2) return false;

  const categorias = categoriasEnOrden(opciones);
  if (categorias.length !== opciones.length) return false;

  const nombres = opciones.map((opcion) =>
    normalizarTextoPedido(opcion.nombre.trim())
  );
  if (new Set(nombres).size === 1) return true;

  return false;
}

export function extraerProductoBuscado(segmento: string): string | undefined {
  const producto = extraerProductoTextoCliente(segmento).trim();
  return producto || undefined;
}

export function lineaPendienteDesdeAmbiguo(input: {
  segmento: string;
  cantidad: number;
  cantidadTexto: string;
  unidad: "kg" | "pieza" | null;
}): LineaInterpretada {
  const unidadExplicita = inferirUnidadExplicitaDesdeSegmento(input.segmento);
  const unidad: "kg" | "pieza" = unidadExplicita ?? input.unidad ?? "pieza";
  const cantidad = input.cantidad > 0 ? input.cantidad : 1;

  return {
    producto_id: PRODUCTO_PENDIENTE_DISAMBIGUACION_ID,
    cantidad,
    unidad,
    textoOriginal: input.segmento,
    cantidadTexto: normalizarCantidadTextoParaDisplay({
      cantidad,
      unidad,
      cantidadTexto: input.cantidadTexto,
      segmento: input.segmento,
    }),
    nombreMostrar: extraerProductoTextoCliente(input.segmento),
  };
}

export function construirMensajeDisambiguacion(
  opciones: OpcionDisambiguacion[],
  productoBuscado?: string
): string {
  if (esDisambiguacionPorEspecie(opciones, productoBuscado)) {
    const termino =
      normalizarPluralesComerciales(productoBuscado?.trim() || "producto").toLowerCase();
    return [
      `¿La ${termino} es de RES o de CERDO?`,
      "",
      "1. 🐄 RES",
      "2. 🐷 CERDO",
    ].join("\n");
  }

  if (esAmbiguedadPorCategoria(opciones, productoBuscado)) {
    const categorias = categoriasEnOrden(opciones);
    const termino = productoBuscado?.trim() || opciones[0]?.nombre || "producto";
    const lineas = categorias.map((categoria, indice) => {
      const opcion = `${indice + 1}. ${categoria}`;
      return indice === categorias.length - 1 ? `${opcion}?` : opcion;
    });
    return [`¿Las ${termino} son de:`, "", ...lineas].join("\n");
  }

  if (productoBuscado?.trim()) {
    const termino = normalizarPluralesComerciales(productoBuscado.trim());
    const lineas = opciones.map(
      (opcion, indice) => `${indice + 1}. ${opcion.nombre}`
    );
    return [`¿A cuál ${termino} se refiere?`, "", ...lineas].join("\n");
  }

  const lineas = opciones.map((opcion, indice) => `${indice + 1}. ${opcion.nombre}`);
  return ["¿Se refiere a?", "", ...lineas].join("\n");
}

function limpiarRespuestaDisambiguacion(mensaje: string): string {
  let normalizado = normalizarTextoPedido(mensaje.trim());
  const prefijos = /^(es|son|el|la|los|las|era|eran|seria|serian|quiero|dame|ponme)\s+/;

  while (prefijos.test(normalizado)) {
    normalizado = normalizado.replace(prefijos, "").trim();
  }

  return normalizarPluralesComerciales(normalizado);
}

function resolverPorNombre(
  mensaje: string,
  pendiente: DisambiguacionPendiente
): OpcionDisambiguacion | null {
  const normalizado = limpiarRespuestaDisambiguacion(mensaje);
  if (!normalizado) return null;

  for (const opcion of pendiente.opciones) {
    if (nombresEquivalentes(normalizado, opcion.nombre)) {
      return opcion;
    }
  }

  for (const opcion of pendiente.opciones) {
    const nombreNorm = normalizarNombreProducto(opcion.nombre);
    if (normalizado.includes(nombreNorm)) {
      return opcion;
    }
  }

  for (const opcion of pendiente.opciones) {
    const nombreNorm = normalizarNombreProducto(opcion.nombre);
    if (nombreNorm.includes(normalizado) && normalizado.length >= 3) {
      return opcion;
    }
  }

  return null;
}

function resolverPorCategoria(
  mensaje: string,
  pendiente: DisambiguacionPendiente
): OpcionDisambiguacion | null {
  const categorias = categoriasEnOrden(pendiente.opciones);
  if (categorias.length < 2) return null;

  const seleccion = resolverSeleccionCategoria(mensaje, categorias);
  if (!seleccion) return null;

  const categoriaElegida = categorias[seleccion - 1];
  return (
    pendiente.opciones.find((opcion) => opcion.categoria === categoriaElegida) ??
    null
  );
}

export function segmentoConEspecieResuelta(
  segmento: string,
  categoria: string | undefined
): string {
  if (!categoria || especieYaEspecificadaEnBusqueda(segmento)) return segmento;

  const especie =
    categoria === "Res" ? "de res" : categoria === "Cerdo" ? "de cerdo" : "";
  if (!especie) return segmento;

  const producto = extraerProductoTextoCliente(segmento).trim();
  if (!producto) return `${segmento} ${especie}`.trim();

  const indice = segmento.toLowerCase().lastIndexOf(producto.toLowerCase());
  if (indice >= 0) {
    return `${segmento.slice(0, indice + producto.length)} ${especie}${segmento.slice(indice + producto.length)}`.trim();
  }

  return `${segmento} ${especie}`.trim();
}

export function resolverSeleccionDisambiguacion(
  mensaje: string,
  pendiente: DisambiguacionPendiente
): OpcionDisambiguacion | null {
  if (esDisambiguacionPorEspecie(pendiente.opciones, pendiente.productoBuscado)) {
    const porCategoria = resolverPorCategoria(mensaje, pendiente);
    if (porCategoria) return porCategoria;
  }

  if (esAmbiguedadPorCategoria(pendiente.opciones, pendiente.productoBuscado)) {
    const porCategoria = resolverPorCategoria(mensaje, pendiente);
    if (porCategoria) return porCategoria;
  }

  const match = mensaje.trim().match(/^(\d+)/);
  if (match) {
    const indice = Number(match[1]) - 1;
    if (
      Number.isFinite(indice) &&
      indice >= 0 &&
      indice < pendiente.opciones.length
    ) {
      return pendiente.opciones[indice];
    }
  }

  return resolverPorNombre(mensaje, pendiente);
}

function siguienteEnCola(
  pendiente: DisambiguacionPendiente
): DisambiguacionPendiente | null {
  const [actual, ...resto] = pendiente.cola ?? [];
  if (!actual) return null;

  return {
    ...actual,
    mensajeOriginal: pendiente.mensajeOriginal ?? pendiente.segmento,
    cola: resto,
  };
}

export function continuarDisambiguacionComercial(input: {
  mensaje: string;
  pendiente: DisambiguacionPendiente;
  unidadPorProductoId?: Map<string, "kg" | "pieza">;
}): ContinuarDisambiguacionResult {
  const opcion = resolverSeleccionDisambiguacion(input.mensaje, input.pendiente);
  if (!opcion) {
    return {
      ok: false,
      respuestaInvalida: construirMensajeDisambiguacion(
        input.pendiente.opciones,
        input.pendiente.productoBuscado
      ),
    };
  }

  const unidad =
    input.pendiente.unidad ??
    input.unidadPorProductoId?.get(opcion.id) ??
    "pieza";

  const textoOriginal = esDisambiguacionPorEspecie(
    input.pendiente.opciones,
    input.pendiente.productoBuscado
  )
    ? segmentoConEspecieResuelta(input.pendiente.segmento, opcion.categoria)
    : input.pendiente.segmento;

  const linea: LineaInterpretada = {
    producto_id: opcion.id,
    cantidad: input.pendiente.cantidad > 0 ? input.pendiente.cantidad : 1,
    unidad,
    textoOriginal,
    cantidadTexto: input.pendiente.cantidadTexto || undefined,
  };

  const siguiente = siguienteEnCola(input.pendiente);

  return {
    ok: true,
    linea,
    productoNombre: opcion.nombre,
    siguiente,
    aclaracion: siguiente
      ? construirMensajeDisambiguacion(
          siguiente.opciones,
          siguiente.productoBuscado
        )
      : undefined,
  };
}
