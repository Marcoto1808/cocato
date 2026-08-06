export type LineaInterpretadaCarrito = {
  producto_id: string;
  cantidad: number;
  unidad: "kg" | "pieza";
  textoOriginal: string;
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
  contextoGuiado?: ContextoGuiado | null;
  registro?: ContextoRegistro | null;
  entrega?: ContextoEntrega | null;
  mensajeLibre?: string;
  modo?: "guiado" | "libre" | "repetir";
};

export function carritoVacio(): CarritoConversacion {
  return { lineas: [], contextoGuiado: null };
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
    modo:
      raw.modo === "guiado" || raw.modo === "libre" || raw.modo === "repetir"
        ? raw.modo
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
  };
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
