-- Políticas RLS para public.clientes
-- COCATO usa el cliente anónimo de Supabase (sin Supabase Auth).
-- Si RLS está activo sin políticas, las peticiones fallan con 401/403.
--
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_select_anon" ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert_anon" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update_anon" ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete_anon" ON public.clientes;

CREATE POLICY "clientes_select_anon"
  ON public.clientes
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "clientes_insert_anon"
  ON public.clientes
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "clientes_update_anon"
  ON public.clientes
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "clientes_delete_anon"
  ON public.clientes
  FOR DELETE
  TO anon
  USING (true);
