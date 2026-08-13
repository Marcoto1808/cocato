import type { AnalisisPedidoIA, LineaExtraidaIA } from "./extract-pedido.ts";
import type { ProductoCatalogo } from "../repositories/product.repository.ts";
import type { DisambiguacionPendiente } from "./disambiguacion.ts";
import { interpretarMensajeComercial } from "./motor-comercial.ts";

export type ResultadoInterpretacionSimple =
  | {
      ok: true;
      analisis: AnalisisPedidoIA;
      observacionesLista: string[];
      aclaracion?: string;
      disambiguacion?: DisambiguacionPendiente;
    }
  | { ok: false; motivo: string };
/** Interpretación determinística para mensajes de pedido. */
export function interpretarMensajeSimple(input: {
  mensaje: string;
  productos: ProductoCatalogo[];
  nombreCliente: string;
}): ResultadoInterpretacionSimple {
  const resultado = interpretarMensajeComercial({
    texto: input.mensaje,
    productos: input.productos,
  });

  if (resultado.tipo === "referencia_historica") {
    return { ok: false, motivo: resultado.motivo };
  }

  if (resultado.tipo === "no_interpretado") {
    return { ok: false, motivo: resultado.motivo };
  }

  const lineas: LineaExtraidaIA[] = resultado.lineas.map((linea) => {
    const producto = input.productos.find((item) => item.id === linea.producto_id);
    return {
      producto_id: linea.producto_id,
      producto_nombre: linea.nombreMostrar ?? producto?.nombre ?? linea.textoOriginal,
      cantidad: linea.cantidad,
      unidad: linea.unidad,
      cantidad_texto: linea.cantidadTexto,
      texto_original: linea.textoOriginal,
    };
  });

  const observacionesLista = [...new Set(resultado.observaciones ?? [])];

  return {
    ok: true,
    aclaracion: resultado.aclaracion,
    disambiguacion: resultado.disambiguacion,
    observacionesLista,
    analisis: {
      es_pedido: true,
      lineas,
      observaciones: observacionesLista.length > 0 ? observacionesLista.join(", ") : null,
      respuesta_cliente: `Entendido, ${input.nombreCliente}.`,
      motivo_no_pedido: null,
    },
  };
}
