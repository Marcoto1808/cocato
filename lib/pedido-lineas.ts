import {
  calcularSubtotalLineaCaptura,
  redondearMoneda,
} from "@/lib/pedido-calculo";
import { cantidadNumericaParaCalculo, esCantidadTexto, importeFijoDesdeCantidad } from "@/lib/pedido-cantidad";
import { normalizarUnidadCaptura } from "@/lib/pedido-unidades";
import {
  esTipoCalculoProducto,
  tipoCalculoPorDefecto,
  type TipoCalculoProducto,
} from "@/lib/tipo-calculo-producto";

export type LineaPedidoEditable = {
  id: string;
  producto_id: string;
  nombre: string;
  unidad: string;
  tipo_calculo: TipoCalculoProducto;
  cantidad_solicitada: number;
  cantidad_texto: string | null;
  peso_real: number | null;
  precio_lista: number;
  precio_aplicado: number;
  precio_modificado: boolean;
  subtotal: number;
};

export type LineaDetallePedido = {
  id: string;
  producto_id?: string;
  cantidad_solicitada: number;
  cantidad_texto?: string | null;
  unidad: string;
  tipo_calculo?: string | null;
  peso_real?: number | null;
  precio_lista?: number | null;
  precio_aplicado: number;
  precio_modificado?: boolean | null;
  subtotal: number;
  productos: { nombre: string } | { nombre: string }[] | null;
};

function resolverProductoJoin(
  productos: LineaDetallePedido["productos"]
): { nombre: string } | null {
  if (!productos) return null;
  return Array.isArray(productos) ? (productos[0] ?? null) : productos;
}

export function normalizarLineaPedido(
  linea: LineaPedidoEditable
): LineaPedidoEditable {
  const tipo_calculo = esTipoCalculoProducto(linea.tipo_calculo)
    ? linea.tipo_calculo
    : tipoCalculoPorDefecto(linea.unidad);

  const cantidad = Number(linea.cantidad_solicitada);
  const cantidad_texto = linea.cantidad_texto?.trim() || null;
  const cantidadEsTexto = esCantidadTexto(cantidad_texto);
  const importeFijo = importeFijoDesdeCantidad(cantidad_texto);
  const cantidadCalculo = cantidadNumericaParaCalculo(cantidad, cantidad_texto);
  const precio_aplicado = Number(linea.precio_aplicado);
  const peso_real =
    linea.peso_real === null || linea.peso_real === undefined
      ? null
      : Number(linea.peso_real);

  return {
    ...linea,
    unidad: normalizarUnidadCaptura(linea.unidad),
    tipo_calculo,
    cantidad_solicitada: cantidad,
    cantidad_texto,
    precio_lista: Number(linea.precio_lista),
    precio_aplicado,
    peso_real,
    subtotal: calcularSubtotalLineaCaptura(
      linea.unidad,
      cantidadCalculo,
      precio_aplicado,
      peso_real,
      cantidadEsTexto,
      importeFijo
    ),
  };
}

export function recalcularLineaPedido(
  linea: LineaPedidoEditable
): LineaPedidoEditable {
  const cantidadEsTexto = esCantidadTexto(linea.cantidad_texto);
  const importeFijo = importeFijoDesdeCantidad(linea.cantidad_texto);
  const cantidadCalculo = cantidadNumericaParaCalculo(
    linea.cantidad_solicitada,
    linea.cantidad_texto
  );

  return {
    ...linea,
    subtotal: calcularSubtotalLineaCaptura(
      linea.unidad,
      cantidadCalculo,
      linea.precio_aplicado,
      linea.peso_real,
      cantidadEsTexto,
      importeFijo
    ),
  };
}

export function lineaPedidoDesdeDetalle(
  linea: LineaDetallePedido,
  productoIdFallback = ""
): LineaPedidoEditable {
  const producto = resolverProductoJoin(linea.productos);

  const tipo_calculo: TipoCalculoProducto = esTipoCalculoProducto(
    linea.tipo_calculo ?? ""
  )
    ? (linea.tipo_calculo as TipoCalculoProducto)
    : tipoCalculoPorDefecto(linea.unidad);

  const precio_lista = Number(linea.precio_lista ?? linea.precio_aplicado);

  return normalizarLineaPedido({
    id: linea.id,
    producto_id: linea.producto_id ?? productoIdFallback,
    nombre: producto?.nombre ?? "Producto",
    unidad: normalizarUnidadCaptura(linea.unidad),
    tipo_calculo,
    cantidad_solicitada: Number(linea.cantidad_solicitada),
    cantidad_texto: linea.cantidad_texto?.trim() || null,
    peso_real: linea.peso_real ?? null,
    precio_lista,
    precio_aplicado: Number(linea.precio_aplicado),
    precio_modificado: linea.precio_modificado ?? false,
    subtotal: redondearMoneda(Number(linea.subtotal)),
  });
}
