-- Corrige public.verificar_login cuando crypt() no se encuentra.
-- En Supabase, pgcrypto instala crypt/gen_salt en el schema "extensions".
-- Ejecutar en Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DROP FUNCTION IF EXISTS public.verificar_login(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.verificar_login(
  p_usuario TEXT,
  p_password TEXT
)
RETURNS TABLE (
  id UUID,
  nombre TEXT,
  usuario TEXT,
  correo TEXT,
  rol TEXT,
  activo BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.nombre,
    u.usuario,
    u.correo,
    u.rol,
    u.activo
  FROM public.usuarios u
  WHERE lower(u.usuario) = lower(p_usuario)
    AND u.password_hash = extensions.crypt(p_password, u.password_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.verificar_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verificar_login(TEXT, TEXT) TO authenticated;

-- Verificación opcional:
-- SELECT * FROM public.verificar_login('marco', '180898');
