-- Pedido rápido: columnas en pedidos + cliente placeholder interno.
-- EJECUTAR MANUALMENTE en Supabase SQL Editor antes de usar Pedido rápido.
--
-- Este script NO usa la columna es_sistema (no existe en tu base actual).
-- El cliente interno se identifica por nombre: 'Cliente temporal'.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cliente_nombre_temporal TEXT,
  ADD COLUMN IF NOT EXISTS cliente_telefono_temporal TEXT;

COMMENT ON COLUMN public.pedidos.cliente_nombre_temporal IS
  'Nombre capturado en pedido rápido antes de registrar al cliente.';
COMMENT ON COLUMN public.pedidos.cliente_telefono_temporal IS
  'Reservado para uso futuro; pedido rápido actual solo captura nombre.';

CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_nombre_temporal
  ON public.pedidos (cliente_nombre_temporal)
  WHERE cliente_nombre_temporal IS NOT NULL;

-- Cliente placeholder para pedidos rápidos (no debe editarse ni usarse como cliente real).
INSERT INTO public.clientes (
  nombre_negocio,
  tipo_cliente_id,
  activo,
  limite_credito
)
SELECT
  'Cliente temporal',
  tc.id,
  true,
  0
FROM public.tipos_cliente tc
WHERE tc.codigo = 'detalle'
  AND NOT EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.nombre_negocio = 'Cliente temporal'
  );
