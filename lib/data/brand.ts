import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = createClient();
  const { data } = await supabase
    .from("brands")
    .select("id, name, market, slug")
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data ?? null;
});

// Pure formatters live in lib/format.ts (client-safe). Re-exported here for
// back-compat with server-side callers that import from this module.
export { marketLabel, formatScanWeek } from "@/lib/format";
