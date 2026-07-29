ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS observaciones TEXT;
