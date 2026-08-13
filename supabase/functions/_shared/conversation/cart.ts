import type { DisambiguacionPendiente } from "../openai/disambiguacion.ts";
import { esLineaPendienteDisambiguacion } from "../openai/linea-libre.ts";
import type { EstadoComercialConversacion } from "./states.ts";

export type RecuperacionPedidoPendiente = {
  estadoGuardado: EstadoComercialConversacion;
  carritoGuardado: Omit<CarritoConversacion, "recuperacionPedido">;
};

export type LineaInterpretadaCarrito = {
  producto_id: string;
  cantidad: number;
  unidad: "kg" | "pieza";
  textoOriginal: string;
  cantidadTexto?: string;
};

export type LineaCarrito = {
  textoOriginal: string;
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
  unidad: "kg" | "pieza";
  cantidadTexto?: string;
};

export type ContextoGuiado = {
  categoria?: string;
  productoId?: string;
  productoNombre?: string;
  textoPedido?: string;
  especiePreferida?: "Res" | "Cerdo";
  slotsGuiado?: import("./pedido-guiado-productos.ts").ProductoGuiadoSlot[];
  /** Productos seleccionados pendientes de capturar cantidad. */
  colaCantidadGuiada?: import("./pedido-guiado-productos.ts").ProductoGuiadoSlot[];
  /** Índice del producto actual dentro de colaCantidadGuiada. */
  indiceCantidadGuiada?: number;
};

export type ContextoRegistro = {
  telefono?: string;
};

export type ContextoEntrega = {
  pedidoId?: string;
  tipo?: "domicilio" | "recoger";
};

export type CarritoConversacion = {
  lineas: LineaCarrito[];
  totalEstimado?: number;
  observaciones?: string[];
  /** Especie elegida al inicio del pedido guiado (res / cerdo). */
  especiePreferida?: "Res" | "Cerdo";
  contextoGuiado?: ContextoGuiado | null;
  contextoDisambiguacion?: DisambiguacionPendiente | null;
  recuperacionPedido?: RecuperacionPedidoPendiente | null;
  registro?: ContextoRegistro | null;
  entrega?: ContextoEntrega | null;
  mensajeLibre?: string;
  modo?: "guiado" | "libre" | "repetir";
};

export function carritoVacio(): CarritoConversacion {
  return {
    lineas: [],
    contextoGuiado: null,
    contextoDisambiguacion: null,
    recuperacionPedido: null,
    registro: null,
    entrega: null,
    observaciones: undefined,
    totalEstimado: undefined,
    mensajeLibre: undefined,
    modo: undefined,
  };
}

export function parsearCarritoConversacion(valor: unknown): CarritoConversacion {
  if (!valor || typeof valor !== "object") return carritoVacio();
  const raw = valor as Partial<CarritoConversacion>;
  const lineas = Array.isArray(raw.lineas)
    ? raw.lineas.filter(
        (linea): linea is LineaCarrito =>
          Boolean(
            linea &&
              typeof linea === "object" &&
              typeof linea.textoOriginal === "string" &&
              typeof linea.producto_id === "string" &&
              typeof linea.producto_nombre === "string" &&
              typeof linea.cantidad === "number" &&
              (linea.unidad === "kg" || linea.unidad === "pieza")
          )
      )
    : [];

  return {
    lineas,
    totalEstimado:
      typeof raw.totalEstimado === "number" ? raw.totalEstimado : undefined,
    observaciones: Array.isArray(raw.observaciones)
      ? raw.observaciones.filter((item): item is string => typeof item === "string")
      : undefined,
    contextoGuiado:
      raw.contextoGuiado && typeof raw.contextoGuiado === "object"
        ? raw.contextoGuiado
        : null,
    contextoDisambiguacion:
      raw.contextoDisambiguacion && typeof raw.contextoDisambiguacion === "object"
        ? raw.contextoDisambiguacion
        : null,
    recuperacionPedido:
      raw.recuperacionPedido && typeof raw.recuperacionPedido === "object"
        ? raw.recuperacionPedido
        : null,
    modo:
      raw.modo === "guiado" || raw.modo === "libre" || raw.modo === "repetir"
        ? raw.modo
        : undefined,
    especiePreferida:
      raw.especiePreferida === "Res" || raw.especiePreferida === "Cerdo"
        ? raw.especiePreferida
        : undefined,
    mensajeLibre:
      typeof raw.mensajeLibre === "string" ? raw.mensajeLibre : undefined,
    registro:
      raw.registro && typeof raw.registro === "object" ? raw.registro : null,
    entrega:
      raw.entrega && typeof raw.entrega === "object" ? raw.entrega : null,
  };
}

export function mensajeOriginalDesdeCarrito(lineas: LineaCarrito[]): string {
  return lineas.map((linea) => linea.textoOriginal).join("\n");
}

export function lineaCarritoDesdeInterpretada(
  linea: LineaInterpretadaCarrito,
  productoNombre: string
): LineaCarrito {
  return {
    textoOriginal: linea.textoOriginal,
    producto_id: linea.producto_id,
    producto_nombre: productoNombre,
    cantidad: linea.cantidad,
    unidad: linea.unidad,
    cantidadTexto: linea.cantidadTexto,
  };
}

export function reemplazarLineaPendienteDisambiguacion(
  lineas: LineaCarrito[],
  segmentoPendiente: string,
  lineaResuelta: LineaCarrito
): LineaCarrito[] {
  const indice = lineas.findIndex(
    (linea) =>
      esLineaPendienteDisambiguacion(linea.producto_id) &&
      linea.textoOriginal === segmentoPendiente
  );

  if (indice < 0) {
    return [...lineas, lineaResuelta];
  }

  const actualizadas = [...lineas];
  actualizadas[indice] = lineaResuelta;
  return actualizadas;
}

export function agregarLineasAlCarrito(
  carrito: CarritoConversacion,
  nuevas: LineaCarrito[],
  observacionesNuevas?: string[]
): CarritoConversacion {
  const observaciones = [
    ...(carrito.observaciones ?? []),
    ...(observacionesNuevas ?? []),
  ];

  return {
    ...carrito,
    lineas: [...carrito.lineas, ...nuevas],
    totalEstimado: undefined,
    observaciones: observaciones.length > 0 ? [...new Set(observaciones)] : undefined,
  };
}
