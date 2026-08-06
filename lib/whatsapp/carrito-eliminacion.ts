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

export type SolicitudEliminacion =
  | { tipo: "vaciar" }
  | { tipo: "parcial"; cantidad: number; cantidadTexto: string; productoTexto: string }
  | { tipo: "linea_completa"; productoTexto: string };

export type ResultadoEliminacionCarrito =
  | { ok: true; carrito: CarritoConversacion; detalleEliminado: string }
  | { ok: false; error: string };

const VERBO_ELIMINAR =
  /^(quitar|quita|eliminar|elimina|borrar|borra|cancelar|remueve|sacar)\s+(.+)$/i;

const FRASES_REINICIAR = ["empezar de nuevo", "empezar otra vez"];

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

  if (FRASES_REINICIAR.some((frase) => normalizado === frase)) {
    return { tipo: "vaciar" };
  }

  const verboMatch = normalizado.match(VERBO_ELIMINAR);
  if (!verboMatch) return null;

  const resto = verboMatch[2].trim();
  if (!resto) return null;

  if (resto === "todo") {
    return { tipo: "vaciar" };
  }

  const separado = separarCantidadInicial(resto);
  if (separado) {
    return {
      tipo: "parcial",
      cantidad: separado.cantidad,
      cantidadTexto: separado.cantidadTexto,
      productoTexto: separado.resto,
    };
  }

  return { tipo: "linea_completa", productoTexto: resto };
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

  const linea = encontrarLineaEnCarrito(
    carrito.lineas,
    solicitud.productoTexto,
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
    "Hasta el momento lleva:",
    "",
    resumen,
    "",
    "¿Desea agregar algo más?",
    "",
    "Escriba otro producto o escriba *listo* para confirmar.",
  ].join("\n");
}
