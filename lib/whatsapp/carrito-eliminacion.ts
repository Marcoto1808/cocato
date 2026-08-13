import type { ProductoCatalogo } from "@/lib/interpretacion/mensaje-interpreter";
import {
  pluralizarNombreProducto,
  normalizarTextoPedido,
} from "@/lib/interpretacion/cantidad-natural";
import {
  nombresEquivalentes,
  resolverProductoEnCatalogo,
  separarCantidadInicial,
} from "@/lib/interpretacion/resolver-producto";
import type { CarritoConversacion, LineaCarrito } from "@/lib/whatsapp/conversation-cart";
import { construirMensajePostAgregarCarrito } from "@/lib/whatsapp/conversation-states";

export type SolicitudEliminacion =
  | { tipo: "vaciar" }
  | { tipo: "ultima_linea" }
  | { tipo: "parcial"; cantidad: number; cantidadTexto: string; productoTexto: string }
  | { tipo: "linea_completa"; productoTexto: string };

export type ResultadoEliminacionCarrito =
  | { ok: true; carrito: CarritoConversacion; detalleEliminado: string }
  | { ok: false; error: string };

const VERBO_ELIMINAR =
  /^(?:quitar|quita|eliminar|elimina|borrar|borra|cancelar|remueve|remover|sacar|no quiero|mejor quita|mejor quitar)\s+(.+)$/i;

export function limpiarProductoEliminacion(texto: string): string {
  let limpio = texto.trim();
  const prefijos =
    /^(?:la|las|el|los|del|de la|de el|de los|de|un|una|uno)\s+/i;

  while (prefijos.test(limpio)) {
    limpio = limpio.replace(prefijos, "").trim();
  }

  return limpio;
}

function parsearRestoEliminacion(resto: string): SolicitudEliminacion | null {
  const limpio = resto.trim();
  if (!limpio) return null;

  if (limpio === "todo") {
    return { tipo: "vaciar" };
  }

  if (
    /^(?:el|la|los|las)?\s*ultim[oa](?:\s+producto)?$/i.test(limpio) ||
    limpio === "ultimo producto"
  ) {
    return { tipo: "ultima_linea" };
  }

  const importe = limpio.match(
    /^(?:(?:los|las)\s+)?(\d+(?:[.,]\d+)?)\s*pesos?\s+(?:de\s+)?(.+)$/i
  );
  if (importe) {
    const productoTexto = limpiarProductoEliminacion(importe[2]);
    if (!productoTexto) return null;
    return { tipo: "linea_completa", productoTexto };
  }

  const separado = separarCantidadInicial(limpio);
  if (separado) {
    return {
      tipo: "parcial",
      cantidad: separado.cantidad,
      cantidadTexto: separado.cantidadTexto,
      productoTexto: limpiarProductoEliminacion(separado.resto),
    };
  }

  return {
    tipo: "linea_completa",
    productoTexto: limpiarProductoEliminacion(limpio),
  };
}

function normalizarEntrada(texto: string): string {
  return normalizarTextoPedido(texto.trim().replace(/[.!?]+$/, ""));
}

export function esSolicitudEliminacion(mensaje: string): boolean {
  return parsearSolicitudEliminacion(mensaje) !== null;
}

export function parsearSolicitudEliminacion(
  mensaje: string
): SolicitudEliminacion | null {
  const normalizado = normalizarEntrada(mensaje);
  if (!normalizado) return null;

  const verboMatch = normalizado.match(VERBO_ELIMINAR);
  if (!verboMatch) return null;

  return parsearRestoEliminacion(verboMatch[1]);
}

function formatearDetalleEliminacion(
  cantidad: number,
  productoNombre: string,
  unidad: "kg" | "pieza"
): string {
  if (unidad === "kg") {
    const cantidadStr = Number.isInteger(cantidad) ? String(cantidad) : String(cantidad);
    return `${cantidadStr} kg ${productoNombre}`;
  }

  const nombre = pluralizarNombreProducto(productoNombre, cantidad);
  const cantidadStr = Number.isInteger(cantidad) ? String(cantidad) : String(cantidad);
  return `${cantidadStr} ${nombre}`;
}

function encontrarLineaEnCarrito(
  lineas: LineaCarrito[],
  productoTexto: string,
  productos: ProductoCatalogo[]
): LineaCarrito | undefined {
  const resolucion = resolverProductoEnCatalogo(productoTexto, productos);
  if (resolucion.tipo === "ok") {
    const porId = lineas.find((linea) => linea.producto_id === resolucion.producto.id);
    if (porId) return porId;
  }

  return lineas.find((linea) =>
    nombresEquivalentes(linea.producto_nombre, productoTexto)
  );
}

function eliminarLinea(
  carrito: CarritoConversacion,
  productoId: string
): CarritoConversacion {
  return {
    ...carrito,
    lineas: carrito.lineas.filter((linea) => linea.producto_id !== productoId),
    totalEstimado: undefined,
  };
}

function actualizarCantidadLinea(
  carrito: CarritoConversacion,
  productoId: string,
  nuevaCantidad: number
): CarritoConversacion {
  return {
    ...carrito,
    lineas: carrito.lineas.map((linea) =>
      linea.producto_id === productoId
        ? {
            ...linea,
            cantidad: nuevaCantidad,
            cantidadTexto: String(nuevaCantidad),
          }
        : linea
    ),
    totalEstimado: undefined,
  };
}

export function aplicarEliminacionCarrito(
  carrito: CarritoConversacion,
  solicitud: SolicitudEliminacion,
  productos: ProductoCatalogo[]
): ResultadoEliminacionCarrito {
  if (solicitud.tipo === "vaciar") {
    return {
      ok: true,
      carrito: { ...carrito, lineas: [], totalEstimado: undefined },
      detalleEliminado: "todo",
    };
  }

  if (solicitud.tipo === "ultima_linea") {
    const linea = carrito.lineas.at(-1);
    if (!linea) {
      return {
        ok: false,
        error: "Su pedido está vacío.",
      };
    }

    const detalleEliminado = formatearDetalleEliminacion(
      linea.cantidad,
      linea.producto_nombre,
      linea.unidad
    );

    return {
      ok: true,
      carrito: {
        ...carrito,
        lineas: carrito.lineas.slice(0, -1),
        totalEstimado: undefined,
      },
      detalleEliminado,
    };
  }

  const linea = encontrarLineaEnCarrito(
    carrito.lineas,
    limpiarProductoEliminacion(solicitud.productoTexto),
    productos
  );

  if (!linea) {
    return {
      ok: false,
      error: `No encontré "${solicitud.productoTexto}" en su pedido actual.`,
    };
  }

  if (solicitud.tipo === "linea_completa") {
    const detalleEliminado = formatearDetalleEliminacion(
      linea.cantidad,
      linea.producto_nombre,
      linea.unidad
    );

    return {
      ok: true,
      carrito: eliminarLinea(carrito, linea.producto_id),
      detalleEliminado,
    };
  }

  const cantidadEliminar = solicitud.cantidad;
  const detalleEliminado = formatearDetalleEliminacion(
    cantidadEliminar,
    linea.producto_nombre,
    linea.unidad
  );

  if (cantidadEliminar >= linea.cantidad) {
    return {
      ok: true,
      carrito: eliminarLinea(carrito, linea.producto_id),
      detalleEliminado,
    };
  }

  const nuevaCantidad = linea.cantidad - cantidadEliminar;
  return {
    ok: true,
    carrito: actualizarCantidadLinea(carrito, linea.producto_id, nuevaCantidad),
    detalleEliminado,
  };
}

export function construirMensajePostEliminarCarrito(
  detalleEliminado: string,
  resumen: string
): string {
  const encabezado =
    detalleEliminado === "todo"
      ? "Listo, vacié su pedido."
      : `Listo, eliminé ${detalleEliminado}.`;

  if (!resumen || resumen === "Su pedido está vacío.") {
    return [
      encabezado,
      "",
      "Su pedido está vacío.",
      "",
      "Escriba productos para continuar.",
    ].join("\n");
  }

  return [
    encabezado,
    "",
    construirMensajePostAgregarCarrito(resumen),
  ].join("\n");
}
