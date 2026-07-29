-- Tabla de usuarios COCATO con autenticación segura
-- Ejecutar en Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE,
  correo TEXT,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('Administrador', 'Trabajador')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_usuario ON public.usuarios (usuario);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON public.usuarios (activo);

COMMENT ON TABLE public.usuarios IS 'Usuarios internos de COCATO';
COMMENT ON COLUMN public.usuarios.password_hash IS 'Hash bcrypt generado con pgcrypto crypt()';

-- Verifica credenciales sin exponer password_hash al cliente.
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
SET search_path = public
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
    AND u.password_hash = crypt(p_password, u.password_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.verificar_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verificar_login(TEXT, TEXT) TO authenticated;

-- Administrador inicial (usuario: admin / contraseña: admin123)
INSERT INTO public.usuarios (
  nombre,
  usuario,
  correo,
  password_hash,
  rol,
  activo
)
VALUES (
  'Administrador',
  'admin',
  'admin@cocato.local',
  crypt('admin123', gen_salt('bf')),
  'Administrador',
  true
)
ON CONFLICT (usuario) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  correo = EXCLUDED.correo,
  password_hash = EXCLUDED.password_hash,
  rol = EXCLUDED.rol,
  activo = EXCLUDED.activo;
