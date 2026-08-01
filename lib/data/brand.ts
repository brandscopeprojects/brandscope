import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/demo-mode";

export type BrandSummary = {
  id: string;
  name: string;
  market: string[];
  slug: string;
};

/** Cookie holding the user's currently-selected brand id (set by the switcher). */
export const ACTIVE_BRAND_COOKIE = "bs_active_brand";

/**
 * Every brand in the signed-in user's org (RLS scopes the read to their org),
 * oldest first. Powers the brand switcher and the Portfolio Home. cache()-wrapped
 * so the layout + page share one query per request.
 */
export const listOrgBrands = cache(async function listOrgBrands(): Promise<BrandSummary[]> {
  if (isDemoMode()) {
    const { DEMO_BRAND } = await import("@/lib/data/demo");
    return [DEMO_BRAND];
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, name, market, slug")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return data ?? [];
});

/**
 * The user's ACTIVE brand. Respects the `bs_active_brand` cookie when it points at
 * a brand in the user's org (validated via an RLS-scoped read); otherwise falls
 * back to the newest brand. This is the single chokepoint every (app) page + the
 * shell flow through, so the switcher only needs to set the cookie.
 */
export const getCurrentBrand = cache(async function getCurrentBrand(): Promise<BrandSummary | null> {
  if (isDemoMode()) {
    const { DEMO_BRAND } = await import("@/lib/data/demo");
    return DEMO_BRAND;
  }
  const supabase = createClient();

  const activeId = cookies().get(ACTIVE_BRAND_COOKIE)?.value;
  if (activeId) {
    const { data } = await supabase
      .from("brands")
      .select("id, name, market, slug")
      .eq("id", activeId)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) return data; // cookie points at a brand the user can see → use it
  }

  // No/stale cookie → newest brand wins (deterministic across requests).
  const { data } = await supabase
    .from("brands")
    .select("id, name, market, slug")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
});

// Pure formatters live in lib/format.ts (client-safe). Re-exported here for
// back-compat with server-side callers that import from this module.
export { marketLabel, formatScanWeek } from "@/lib/format";
