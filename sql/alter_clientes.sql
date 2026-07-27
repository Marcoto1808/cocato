-- Columnas adicionales para el módulo de Clientes COCATO
-- Ejecutar en Supabase SQL Editor antes de usar el formulario completo.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

COMMENT ON COLUMN public.clientes.maps_url IS 'URL directa de Google Maps (opcional)';
COMMENT ON COLUMN public.clientes.observaciones IS 'Notas internas sobre el cliente';
