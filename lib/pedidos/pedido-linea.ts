import {
  calcularSubtotalLineaCaptura,
  normalizarPrecioAplicado,
} from "@/lib/pedido-calculo";
import {
  cantidadNumericaParaCalculo,
  cantidadSolicitadaParaGuardar,
  cantidadTextoParaGuardar,
  esCantidadTexto,
  importeFijoDesdeCantidad,
  type CantidadCapturada,
} from "@/lib/pedido-cantidad";
import {
  normalizarUnidadCaptura,
  type UnidadCapturaPedido,
} from "@/lib/pedido-unidades";
import {
  tipoCalculoPorDefecto,
  type TipoCalculoProducto,
} from "@/lib/tipo-calculo-producto";
import type { LineaPedidoInput } from "@/lib/pedidos/pedido-types";

export type ProductoParaLinea = {
  id: string;
  nombre: string;
  unidad: string;
  tipo_calculo?: TipoCalculoProducto | null;
};

export function crearLineaPedidoDesdeProducto(
  producto: ProductoParaLinea,
  precioLista: number,
  parsed: CantidadCapturada,
  unidadCaptura?: UnidadCapturaPedido
): LineaPedidoInput {
  const unidad = unidadCaptura ?? normalizarUnidadCaptura(producto.unidad);
  const tipo_calculo =
    producto.tipo_calculo ?? tipoCalculoPorDefecto(producto.unidad);

  const cantidad = cantidadSolicitadaParaGuardar(parsed);
  const cantidad_texto = cantidadTextoParaGuardar(parsed);
  const cantidadEsTexto = esCantidadTexto(cantidad_texto);
  const importeFijo =
    parsed.tipo === "importe"
      ? parsed.importe
      : importeFijoDesdeCantidad(cantidad_texto);
  const cantidadCalculo = cantidadNumericaParaCalculo(cantidad, cantidad_texto);
  const precio_aplicado = normalizarPrecioAplicado(precioLista);

  return {
    producto_id: producto.id,
    cantidad_solicitada: cantidad,
    cantidad_texto,
    unidad,
    tipo_calculo,
    peso_real: null,
    precio_lista: precioLista,
    precio_aplicado,
    precio_modificado: false,
    subtotal: calcularSubtotalLineaCaptura(
      unidad,
      cantidadCalculo,
      precio_aplicado,
      null,
      cantidadEsTexto,
      importeFijo
    ),
  };
}
