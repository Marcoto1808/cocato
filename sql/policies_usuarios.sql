-- Políticas RLS para public.usuarios
-- La autenticación usa la función verificar_login; no se expone la tabla directamente.

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_select_service" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_all_service" ON public.usuarios;

-- Sin políticas para anon/authenticated: acceso solo vía SECURITY DEFINER (verificar_login).
