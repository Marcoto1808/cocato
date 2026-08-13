import type { ProductoCatalogo } from "@/lib/interpretacion/mensaje-interpreter";
import { normalizarTextoPedido } from "@/lib/interpretacion/cantidad-natural";
import {
  nombresEquivalentes,
  normalizarNombreProducto,
  resolverProductoEnCatalogo,
  separarCantidadInicial,
} from "@/lib/interpretacion/resolver-producto";
import type { CarritoConversacion, LineaCarrito } from "@/lib/whatsapp/conversation-cart";
import { construirMensajePostAgregarCarrito } from "@/lib/whatsapp/conversation-states";
import { limpiarProductoEliminacion } from "@/lib/whatsapp/carrito-eliminacion";

export type SolicitudCorreccion =
  | { tipo: "reemplazar"; productoTexto: string; textoNuevo: string }
  | { tipo: "quise_decir"; textoNuevo: string }
  | { tipo: "aclarar"; textoNuevo: string };

export type ResultadoCorreccionCarrito =
  | { ok: true; carrito: CarritoConversacion; detalleCorregido: string }
  | { ok: false; error: string };

const PATRON_CORRECCION_EXPLICITA =
  /^(?:corrige|corregir|corrija|corregirme)\s+(?:la|las|el|los|del|de la|de el|de los)?\s*(.+?)(?:,|\s+(?:son|era|eran|es|seria|serían|serian))\s+(.+)$/i;

const PATRON_QUISE_DECIR = /^(?:quise decir|queria decir|quería decir)\s+(.+)$/i;

const PATRON_ACLARAR =
  /^(?:es|son|era|eran|seria|serían|serian)\s+(.+)$/i;

function normalizarEntrada(texto: string): string {
  return normalizarTextoPedido(texto.trim().replace(/[.!?]+$/, ""));
}

export function parsearSolicitudCorreccion(
  mensaje: string
): SolicitudCorreccion | null {
  const normalizado = normalizarEntrada(mensaje);
  if (!normalizado) return null;

  const explicita = normalizado.match(PATRON_CORRECCION_EXPLICITA);
  if (explicita) {
    const productoTexto = limpiarProductoEliminacion(explicita[1].trim());
    const textoNuevo = explicita[2]
      .trim()
      .replace(/^(?:son|era|eran|es|seria|serían|serian)\s+/i, "");
    if (!productoTexto || !textoNuevo) return null;
    return { tipo: "reemplazar", productoTexto, textoNuevo };
  }

  const quiseDecir = normalizado.match(PATRON_QUISE_DECIR);
  if (quiseDecir?.[1]?.trim()) {
    return { tipo: "quise_decir", textoNuevo: quiseDecir[1].trim() };
  }

  const aclarar = normalizado.match(PATRON_ACLARAR);
  if (aclarar?.[1]?.trim()) {
    return { tipo: "aclarar", textoNuevo: aclarar[1].trim() };
  }

  return null;
}

function encontrarLineaEnCarrito(
  lineas: LineaCarrito[],
  productoTexto: string,
  productos: ProductoCatalogo[]
): LineaCarrito | undefined {
  const limpio = limpiarProductoEliminacion(productoTexto);
  const resolucion = resolverProductoEnCatalogo(limpio, productos);
  if (resolucion.tipo === "ok") {
    const porId = lineas.find(
      (linea) => linea.producto_id === resolucion.producto.id
    );
    if (porId) return porId;
  }

  return lineas.find((linea) => {
    if (nombresEquivalentes(linea.producto_nombre, limpio)) return true;
    const nombreNorm = normalizarNombreProducto(linea.producto_nombre);
    const buscadoNorm = normalizarNombreProducto(limpio);
    return (
      nombreNorm.includes(buscadoNorm) ||
      buscadoNorm.includes(nombreNorm) ||
      linea.textoOriginal.toLowerCase().includes(limpio.toLowerCase())
    );
  });
}

function inferirProductoDesdeTextoNuevo(
  textoNuevo: string,
  productos: ProductoCatalogo[]
): string | null {
  const separado = separarCantidadInicial(textoNuevo.trim());
  const candidato = separado
    ? limpiarProductoEliminacion(separado.resto)
    : limpiarProductoEliminacion(textoNuevo);

  const resolucion = resolverProductoEnCatalogo(candidato, productos);
  if (resolucion.tipo === "ok") {
    return normalizarNombreProducto(resolucion.producto.nombre);
  }

  const parsed = candidato.trim().split(/\s+/).pop();
  return parsed ? normalizarNombreProducto(parsed) : null;
}

export function aplicarCorreccionCarrito(input: {
  carrito: CarritoConversacion;
  solicitud: SolicitudCorreccion;
  lineaNueva: LineaCarrito;
  productos: ProductoCatalogo[];
}): ResultadoCorreccionCarrito {
  let lineaObjetivo: LineaCarrito | undefined;

  if (input.solicitud.tipo === "reemplazar") {
    lineaObjetivo = encontrarLineaEnCarrito(
      input.carrito.lineas,
      input.solicitud.productoTexto,
      input.productos
    );
  } else if (input.solicitud.tipo === "aclarar") {
    const productoInferido = inferirProductoDesdeTextoNuevo(
      input.solicitud.textoNuevo,
      input.productos
    );
    if (productoInferido) {
      lineaObjetivo = [...input.carrito.lineas]
        .reverse()
        .find((linea) =>
          nombresEquivalentes(linea.producto_nombre, productoInferido)
        );
    }
    lineaObjetivo ??= input.carrito.lineas.at(-1);
  } else {
    const productoInferido = inferirProductoDesdeTextoNuevo(
      input.solicitud.textoNuevo,
      input.productos
    );
    if (productoInferido) {
      lineaObjetivo = input.carrito.lineas.find((linea) =>
        nombresEquivalentes(linea.producto_nombre, productoInferido)
      );
    }
    lineaObjetivo ??= input.carrito.lineas.at(-1);
  }

  if (!lineaObjetivo) {
    return {
      ok: false,
      error: "No encontré en su pedido el producto que desea corregir.",
    };
  }

  const lineas = input.carrito.lineas.map((linea) =>
    linea.producto_id === lineaObjetivo!.producto_id &&
    linea.textoOriginal === lineaObjetivo!.textoOriginal
      ? input.lineaNueva
      : linea
  );

  return {
    ok: true,
    carrito: {
      ...input.carrito,
      lineas,
      totalEstimado: undefined,
    },
    detalleCorregido: input.lineaNueva.textoOriginal,
  };
}

export function construirMensajePostCorregirCarrito(
  detalleCorregido: string,
  resumen: string
): string {
  return [
    `Listo, corregí ${detalleCorregido}.`,
    "",
    construirMensajePostAgregarCarrito(resumen),
  ].join("\n");
}
