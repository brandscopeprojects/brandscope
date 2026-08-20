import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type MethodologyCopy = {
  contentKey: string;
  title: string;
  body: string;
};

/**
 * Sanitized customer-facing read path for market_power_methodology_content.
 * The table itself is Class-2 (RLS enabled, no policy — internal-admin write
 * only); this is the ONLY approved way an authenticated brand route may show
 * methodology/tooltip copy. It returns exactly {contentKey, title, body} —
 * never admin-only fields (updated_by, timestamps) and never scoring
 * weights/thresholds, which do not live in this table at all.
 *
 * Not yet called from any customer route — no Market Power scores are
 * customer-visible yet (Gate 3+). Exists now so the customer UI has a ready
 * data path when that gate lands.
 */
export async function getMethodologyCopy(contentKey: string): Promise<MethodologyCopy | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("market_power_methodology_content")
    .select("content_key, title, body")
    .eq("content_key", contentKey)
    .maybeSingle();
  if (error || !data) return null;
  return { contentKey: data.content_key, title: data.title, body: data.body };
}

export async function getAllMethodologyCopy(): Promise<MethodologyCopy[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("market_power_methodology_content")
    .select("content_key, title, body");
  if (error || !data) return [];
  return data.map((r) => ({ contentKey: r.content_key, title: r.title, body: r.body }));
}
