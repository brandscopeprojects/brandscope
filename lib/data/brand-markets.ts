import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Gate 1 closure — bounded dual-write (V1.5 §brand_markets migration plan,
 * Stage 1). `brands.market` text[] remains the SOURCE OF TRUTH; every writer
 * of that column must also call this so `brand_markets` never goes stale.
 * Do NOT read brand_markets as authoritative before the documented Stage 3
 * flip — this function exists to keep it in sync, not to promote it yet.
 *
 * Upserts a 'tracked' row for each current market and deletes any
 * brand_markets row for a market the brand no longer lists, so the table
 * always mirrors brands.market[] exactly (idempotent, safe to call on every
 * write).
 */
export async function syncBrandMarkets(brandId: string, markets: string[]): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  if (markets.length > 0) {
    const { error: upsertErr } = await admin.from("brand_markets").upsert(
      markets.map((marketCode) => ({
        brand_id: brandId,
        market_code: marketCode,
        detection_status: "tracked" as const,
        tracked_from: now,
        updated_at: now,
      })),
      { onConflict: "brand_id,market_code", ignoreDuplicates: false }
    );
    if (upsertErr) {
      throw new Error(`syncBrandMarkets upsert failed: ${upsertErr.message}`);
    }
  }

  let cleanup = admin.from("brand_markets").delete().eq("brand_id", brandId);
  if (markets.length > 0) {
    // market_code is a simple slug (no commas/parens) — safe to inline in the
    // PostgREST "in" filter list without quoting.
    cleanup = cleanup.not("market_code", "in", `(${markets.join(",")})`);
  }
  const { error: deleteErr } = await cleanup;
  if (deleteErr) {
    throw new Error(`syncBrandMarkets cleanup failed: ${deleteErr.message}`);
  }
}
