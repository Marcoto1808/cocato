/* Sprint 5.4 - alias comerciales de productos
   Ejecutar TODO este script en Supabase SQL Editor. */

CREATE TABLE IF NOT EXISTS public.producto_aliases (  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT producto_aliases_alias_not_empty CHECK (char_length(trim(alias)) > 0),
  CONSTRAINT producto_aliases_producto_alias_unique UNIQUE (producto_id, alias)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_producto_aliases_alias_normalized
  ON public.producto_aliases (lower(trim(alias)));

CREATE INDEX IF NOT EXISTS idx_producto_aliases_producto_id
  ON public.producto_aliases (producto_id);

COMMENT ON TABLE public.producto_aliases IS
  'Alias comerciales que los clientes usan para referirse a un producto del catálogo.';

ALTER TABLE public.producto_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "producto_aliases_select_anon" ON public.producto_aliases;
DROP POLICY IF EXISTS "producto_aliases_insert_anon" ON public.producto_aliases;
DROP POLICY IF EXISTS "producto_aliases_delete_anon" ON public.producto_aliases;

CREATE POLICY "producto_aliases_select_anon"
  ON public.producto_aliases
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "producto_aliases_insert_anon"
  ON public.producto_aliases
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "producto_aliases_delete_anon"
  ON public.producto_aliases
  FOR DELETE
  TO anon
  USING (true);

-- Alias de ejemplo (ajusta si los nombres difieren en tu catálogo)
INSERT INTO public.producto_aliases (producto_id, alias)
SELECT p.id, v.alias
FROM public.productos p
JOIN (
  VALUES
    ('Bistec de puerco', 'bistec'),
    ('Bistec de puerco', 'bistec puerco'),
    ('Bistec de puerco', 'bistec de puerco'),
    ('Bistec de puerco', 'bistec de cerdo'),
    ('Retazo para caldo', 'carne para caldo'),
    ('Retazo para caldo', 'caldo'),
    ('Retazo para caldo', 'retazo')
) AS v(nombre_producto, alias)
  ON p.nombre = v.nombre_producto
ON CONFLICT DO NOTHING;
