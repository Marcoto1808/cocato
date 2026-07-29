import {
  calcularSubtotalLineaCaptura,
  redondearMoneda,
} from "@/lib/pedido-calculo";
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
    precio_lista: Number(linea.precio_lista),
    precio_aplicado,
    peso_real,
    subtotal: calcularSubtotalLineaCaptura(
      linea.unidad,
      cantidad,
      precio_aplicado,
      peso_real
    ),
  };
}

export function recalcularLineaPedido(
  linea: LineaPedidoEditable
): LineaPedidoEditable {
  return {
    ...linea,
    subtotal: calcularSubtotalLineaCaptura(
      linea.unidad,
      linea.cantidad_solicitada,
      linea.precio_aplicado,
      linea.peso_real
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
    peso_real: linea.peso_real ?? null,
    precio_lista,
    precio_aplicado: Number(linea.precio_aplicado),
    precio_modificado: linea.precio_modificado ?? false,
    subtotal: redondearMoneda(Number(linea.subtotal)),
  });
}
