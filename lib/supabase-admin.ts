import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { obtenerSupabaseServiceRoleKey } from "@/lib/supabase-server-key";

let adminClient: SupabaseClient | null = null;

export { obtenerSupabaseServiceRoleKey, obtenerSupabaseSecretKey } from "@/lib/supabase-server-key";

export function supabaseAdminDisponible(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      obtenerSupabaseServiceRoleKey()
  );
}

export function obtenerSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = obtenerSupabaseServiceRoleKey();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL y una clave de servidor (SUPABASE_SERVICE_ROLE_KEY o SUPABASE_SECRET_KEY) son requeridos."
    );
  }

  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return adminClient;
}
