-- Detalle de productos por pedido (preparación COCATO)

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.detalle_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  cantidad_solicitada NUMERIC(10, 3) NOT NULL DEFAULT 1,
  unidad TEXT NOT NULL DEFAULT 'kg',
  peso_real NUMERIC(10, 3),
  precio_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT detalle_pedido_unidad_check
    CHECK (unidad IN ('kg', 'pieza', 'paquete', 'caja')),
  CONSTRAINT detalle_pedido_cantidad_check
    CHECK (cantidad_solicitada > 0),
  CONSTRAINT detalle_pedido_peso_real_check
    CHECK (peso_real IS NULL OR peso_real >= 0),
  CONSTRAINT detalle_pedido_precio_kg_check
    CHECK (precio_kg >= 0),
  CONSTRAINT detalle_pedido_subtotal_check
    CHECK (subtotal >= 0),
  CONSTRAINT detalle_pedido_unique_producto
    UNIQUE (pedido_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_detalle_pedido_pedido_id
  ON public.detalle_pedido (pedido_id);

CREATE INDEX IF NOT EXISTS idx_detalle_pedido_producto_id
  ON public.detalle_pedido (producto_id);

DROP TRIGGER IF EXISTS detalle_pedido_set_updated_at ON public.detalle_pedido;

CREATE TRIGGER detalle_pedido_set_updated_at
BEFORE UPDATE ON public.detalle_pedido
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.detalle_pedido IS 'Líneas de producto por pedido para preparación y cobro';
COMMENT ON COLUMN public.detalle_pedido.cantidad_solicitada IS 'Cantidad pedida por el cliente';
COMMENT ON COLUMN public.detalle_pedido.peso_real IS 'Peso real capturado en preparación (kg)';
COMMENT ON COLUMN public.detalle_pedido.precio_kg IS 'Precio por kg al momento de agregar la línea';
