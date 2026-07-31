import type { TipoCalculoProducto } from "@/lib/tipo-calculo-producto";

export type OrigenPedidoPersistido = "manual" | "whatsapp";

export type LineaPedidoInput = {
  producto_id: string;
  cantidad_solicitada: number;
  cantidad_texto: string | null;
  unidad: string;
  tipo_calculo: TipoCalculoProducto;
  peso_real?: number | null;
  precio_lista: number;
  precio_aplicado: number;
  precio_modificado: boolean;
  subtotal: number;
};

export type CrearPedidoInput = {
  origen: OrigenPedidoPersistido;
  cliente_id: string;
  tipo_cliente_id: string;
  lista_precio_id: string | null;
  mensaje_original: string;
  observaciones?: string | null;
  total: number;
  cliente_nombre_temporal?: string | null;
  cliente_telefono_temporal?: string | null;
  lineas: LineaPedidoInput[];
  validarCredito?: boolean;
  limite_credito?: number;
};

export type CrearPedidoResultado =
  | { ok: true; pedidoId: string }
  | { ok: false; error: string };
