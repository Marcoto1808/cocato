/**
 * Clave de servidor Supabase: compatible con nomenclatura legacy y nueva (sb_secret_…).
 */
export function obtenerSupabaseServiceRoleKey(): string | undefined {
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_SECRET_KEY?.trim();

  return serviceRoleKey || undefined;
}

/** @deprecated Usar obtenerSupabaseServiceRoleKey */
export function obtenerSupabaseSecretKey(): string | undefined {
  return obtenerSupabaseServiceRoleKey();
}
