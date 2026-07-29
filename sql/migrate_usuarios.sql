-- COCATO: migración definitiva de usuarios
-- Reemplaza la tabla legacy por el esquema final.
--
-- Orden de ejecución en Supabase SQL Editor:
--   1. sql/migrate_usuarios.sql   (este archivo)
--   2. sql/policies_usuarios.sql
--
-- Usuarios creados:
--   marco  / 180898  (Administrador)
--   arturo / 12345   (Trabajador)

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Eliminar autenticación y tabla anterior (legacy)
DROP FUNCTION IF EXISTS public.verificar_login(TEXT, TEXT);
DROP TABLE IF EXISTS public.usuarios CASCADE;

CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE,
  correo TEXT,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('Administrador', 'Trabajador')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usuarios_usuario ON public.usuarios (usuario);
CREATE INDEX idx_usuarios_activo ON public.usuarios (activo);
CREATE INDEX idx_usuarios_rol ON public.usuarios (rol);

COMMENT ON TABLE public.usuarios IS 'Usuarios internos de COCATO';
COMMENT ON COLUMN public.usuarios.password_hash IS 'Hash bcrypt generado con pgcrypto crypt()';

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

INSERT INTO public.usuarios (
  nombre,
  usuario,
  correo,
  password_hash,
  rol,
  activo
)
VALUES
  (
    'Marco Torres',
    'marco',
    'marco@cocato.local',
    extensions.crypt('180898', extensions.gen_salt('bf')),
    'Administrador',
    true
  ),
  (
    'Arturo',
    'arturo',
    'arturo@cocato.local',
    extensions.crypt('12345', extensions.gen_salt('bf')),
    'Trabajador',
    true
  );

COMMIT;

-- Verificación opcional (debe devolver 2 filas):
-- SELECT usuario, rol, activo FROM public.usuarios ORDER BY usuario;
