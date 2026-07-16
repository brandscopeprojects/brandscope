import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/data/demo-mode";

export type BrandSummary = {
  id: string;
  name: string;
  market: string[];
  slug: string;
};

/**
 * The signed-in user's brand (RLS scopes the `brands` read to their org).
 * MVP = one brand per org. Wrapped in React cache() so the (app) layout and the
 * page within the same request share a single query.
 */
export const getCurrentBrand = cache(async function getCurrentBrand(): Promise<BrandSummary | null> {
  if (isDemoMode()) {
    const { DEMO_BRAND } = await import("@/lib/data/demo");
    return DEMO_BRAND;
  }
  const supabase = createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, name, market, slug")
    .is("deleted_at", null)
    // Deterministic pick if an org ever holds >1 brand row (e.g. re-onboarding):
    // newest wins — otherwise limit(1) returns an arbitrary row and the dashboard
    // can flip between brands across requests.
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
});

// Pure formatters live in lib/format.ts (client-safe). Re-exported here for
// back-compat with server-side callers that import from this module.
export { marketLabel, formatScanWeek } from "@/lib/format";
