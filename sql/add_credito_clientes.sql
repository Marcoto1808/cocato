-- Crédito por cliente y estado de pago en pedidos.
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS limite_credito NUMERIC(12, 2) NOT NULL DEFAULT 10000;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS estado_pago TEXT,
  ADD COLUMN IF NOT EXISTS pagado_en TIMESTAMPTZ;

-- Pedidos ya entregados sin estado de pago se consideran pendientes de cobro.
UPDATE public.pedidos
SET estado_pago = 'pendiente'
WHERE estado ILIKE '%entregado%'
  AND (estado_pago IS NULL OR estado_pago = '');

-- Límites iniciales según tipo de cliente (solo filas sin límite personalizado explícito).
UPDATE public.clientes c
SET limite_credito = CASE tc.codigo
  WHEN 'fonda' THEN 5000
  WHEN 'carniceria' THEN 10000
  WHEN 'restaurante' THEN 10000
  ELSE c.limite_credito
END
FROM public.tipos_cliente tc
WHERE c.tipo_cliente_id = tc.id;
