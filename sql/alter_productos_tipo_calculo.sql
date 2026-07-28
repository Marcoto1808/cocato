-- Campo tipo_calculo para public.productos
-- Define cómo se calculará el importe en preparación de pedidos.
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS tipo_calculo TEXT NOT NULL DEFAULT 'POR_KILO';

ALTER TABLE public.productos
  DROP CONSTRAINT IF EXISTS productos_tipo_calculo_check;

ALTER TABLE public.productos
  ADD CONSTRAINT productos_tipo_calculo_check
  CHECK (tipo_calculo IN ('POR_KILO', 'POR_PESO_REAL', 'PRECIO_FIJO'));

-- Asignar valor inicial según unidad existente
UPDATE public.productos
SET tipo_calculo = CASE
  WHEN unidad = 'pieza' THEN 'POR_PESO_REAL'
  WHEN unidad IN ('paquete', 'caja') THEN 'PRECIO_FIJO'
  ELSE 'POR_KILO'
END;

COMMENT ON COLUMN public.productos.tipo_calculo IS
  'Método de cálculo del importe: POR_KILO, POR_PESO_REAL o PRECIO_FIJO';
