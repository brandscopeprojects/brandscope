// Service-role Supabase client for Edge Functions. Bypasses RLS — every query
// MUST be scoped to a single brand_id in code (agent-orchestration.md isolation
// rule: never batch across brands in one invocation).

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SUPABASE_URL, SERVICE_ROLE_KEY } from "./env.ts";

export type { SupabaseClient };

let _client: SupabaseClient | null = null;

/** Memoised service-role client (one per function instance). */
export function serviceClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL(), SERVICE_ROLE_KEY(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}
