// Pure, dependency-free helpers for the per-competitor cache data layers.
// Kept separate from competitors.ts (which pulls in `server-only` + React
// `cache`) so they are unit-testable in a plain node environment.

type CompetitorCacheRow = {
  competitor_id: string;
  scan_week: string;
  brand_id?: string | null;
  created_at?: string | null;
  scraped_at?: string | null;
};

/**
 * Collapse per-competitor cache rows to ONE row per (competitor_id, scan_week).
 *
 * Competitors are shared across brands, and the per-competitor cache tables are
 * UNIQUE(brand_id, scan_week, competitor_id) — so reading by `competitor_id`
 * (rather than `brand_id`) lets a brand reuse a competitor's data even when its
 * OWN scan didn't write it (e.g. a failed/partial scan), but can return several
 * rows for the same competitor+week (one per brand that tracks it).
 *
 * Preference order when duplicates collide:
 *   1. the caller brand's OWN row (its scan is authoritative for its view), then
 *   2. the most recently written shared row (freshest `scraped_at`/`created_at`).
 */
export function dedupeCompetitorRows<T extends CompetitorCacheRow>(
  rows: T[],
  ownBrandId: string,
): T[] {
  const freshness = (r: T): string => r.scraped_at ?? r.created_at ?? "";
  const best = new Map<string, T>();
  for (const r of rows) {
    const key = `${r.competitor_id}::${r.scan_week}`;
    const cur = best.get(key);
    if (!cur) {
      best.set(key, r);
      continue;
    }
    const rOwn = r.brand_id === ownBrandId;
    const curOwn = cur.brand_id === ownBrandId;
    if (rOwn !== curOwn) {
      if (rOwn) best.set(key, r);
    } else if (freshness(r) > freshness(cur)) {
      best.set(key, r);
    }
  }
  return Array.from(best.values());
}
