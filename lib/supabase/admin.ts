import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — SERVER-SIDE ONLY.
 * Bypasses RLS. Use only inside Route Handlers / Server Actions / Edge Functions
 * for access to service-role-only tables (profiles, billing, internal/log/config)
 * and agent writes. The `server-only` import makes this a build error if imported
 * into client code. Every query made with this client must be scoped by brand_id
 * in code — RLS will NOT protect you here.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
