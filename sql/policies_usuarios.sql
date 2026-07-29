-- Políticas RLS para public.usuarios
-- Ejecutar DESPUÉS de sql/migrate_usuarios.sql o sql/create_usuarios.sql
--
-- La autenticación usa verificar_login (SECURITY DEFINER).
-- Sin políticas para anon/authenticated: la tabla no es accesible directamente.

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select_service" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert_service" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_service" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_delete_service" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_anon" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_insert_anon" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_anon" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_delete_anon" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_all_service" ON public.usuarios;

REVOKE ALL ON TABLE public.usuarios FROM anon;
REVOKE ALL ON TABLE public.usuarios FROM authenticated;

GRANT EXECUTE ON FUNCTION public.verificar_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verificar_login(TEXT, TEXT) TO authenticated;
