import "server-only";

// Internal-console API guard. Route handlers can't use requireInternalAdmin's
// redirect() semantics (they must return JSON 401/403), so this returns the
// admin client + profile on success and null on any failure. Same role rule as
// the /brandscope-admin middleware: internal_admin or super_admin only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type InternalCtx = {
  admin: SupabaseClient<Database>;
  userId: string;
  role: string;
};

export async function getInternalCtx(): Promise<InternalCtx | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["internal_admin", "super_admin"].includes(profile.role)) return null;

  return { admin, userId: user.id, role: profile.role };
}
