-- Políticas RLS para public.productos
-- COCATO usa el cliente anónimo de Supabase (sin Supabase Auth).
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "productos_select_anon" ON public.productos;
DROP POLICY IF EXISTS "productos_insert_anon" ON public.productos;
DROP POLICY IF EXISTS "productos_update_anon" ON public.productos;
DROP POLICY IF EXISTS "productos_delete_anon" ON public.productos;

CREATE POLICY "productos_select_anon"
  ON public.productos
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "productos_insert_anon"
  ON public.productos
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "productos_update_anon"
  ON public.productos
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "productos_delete_anon"
  ON public.productos
  FOR DELETE
  TO anon
  USING (true);
