import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

let cliente: SupabaseClient | null = null;

function obtenerSupabaseServiceRoleKey(): string | undefined {
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ??
    Deno.env.get("SUPABASE_SECRET_KEY")?.trim();

  return serviceRoleKey || undefined;
}

export function obtenerSupabaseAdmin(): SupabaseClient {
  if (cliente) return cliente;

  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = obtenerSupabaseServiceRoleKey();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL y una clave de servidor (SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY) no disponibles en la Edge Function."
    );
  }

  cliente = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cliente;
}
