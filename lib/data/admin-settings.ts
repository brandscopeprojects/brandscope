import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand } from "@/lib/data/brand";
import type { Database } from "@/types/database.types";

export type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
export type BrandPreferencesRow =
  Database["public"]["Tables"]["brand_preferences"]["Row"];

export type BrandSettings = {
  brand: BrandRow;
  preferences: BrandPreferencesRow | null;
};

/**
 * The signed-in brand-admin's brand profile + module preferences (Screen 20).
 *
 * Both `brands` (RLS brands_own_org) and `brand_preferences` (RLS
 * brand_preferences_own_brands) are Class-1 brand-scoped tables, so we read them
 * through the USER-SESSION client and let RLS scope the rows. getCurrentBrand()
 * (also RLS-scoped) gives the brand id for the request; we then fetch the full
 * `brands` row and the preferences row.
 *
 * `preferences` may be null — a brand that has never saved module toggles has no
 * `brand_preferences` row yet. The caller treats "null" as "all modules on" and
 * the upsert in updateBrandPreferences creates the row on first save.
 *
 * Wrapped in React cache() so repeated calls in one request share a query.
 */
export const getBrandSettings = cache(
  async function getBrandSettings(): Promise<BrandSettings | null> {
    const current = await getCurrentBrand();
    if (!current) return null;

    const supabase = createClient();

    const [{ data: brand }, { data: preferences }] = await Promise.all([
      supabase
        .from("brands")
        .select("*")
        .eq("id", current.id)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("brand_preferences")
        .select("*")
        .eq("brand_id", current.id)
        .maybeSingle(),
    ]);

    if (!brand) return null;

    return { brand, preferences: preferences ?? null };
  },
);
