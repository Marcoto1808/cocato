import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

let cliente: SupabaseClient | null = null;

export function obtenerSupabaseAdmin(): SupabaseClient {
  if (cliente) return cliente;

  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no disponibles en la Edge Function."
    );
  }

  cliente = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return cliente;
}
