import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Uses the ANON key only — reads are RLS-scoped to the
 * signed-in user's brand. Never put a service-role key here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
