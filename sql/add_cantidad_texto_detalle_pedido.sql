-- Cantidad en texto libre para pedidos (ej. "medio kilo", "1/4 kg", "kilo y medio")
ALTER TABLE public.detalle_pedido
  ADD COLUMN IF NOT EXISTS cantidad_texto TEXT;

COMMENT ON COLUMN public.detalle_pedido.cantidad_texto IS
  'Cantidad en texto libre cuando no es numérica; se muestra tal cual en detalle e impresión';
