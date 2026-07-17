// Shared market-level intelligence cache (market_intel_cache, migration 16;
// schema-amendments D.8). Market facts — SERP evidence, brand demand volumes,
// Google Trends scores — are not brand-specific: fetch ONCE per (market,
// scan_week, kind) and share across every brand/signup in that market. A new
// scan_week naturally invalidates (the owner's weekly-freshness rule). All
// failures are swallowed: the cache is an optimisation, never a blocker.

import type { SupabaseClient } from "./supabase.ts";

/** Monday of the current UTC week — matches the scan_week convention. */
export function currentScanWeek(): string {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/** Whole-payload variant: one opaque value per (market, week, kind). */
export async function getOrFetchMarketIntel<T>(
  sb: SupabaseClient,
  market: string,
  kind: string,
  fetcher: () => Promise<T>,
): Promise<{ value: T; fromCache: boolean }> {
  const week = currentScanWeek();
  const m = (market || "global").toLowerCase();
  try {
    const { data } = await sb
      .from("market_intel_cache")
      .select("payload")
      .eq("market", m)
      .eq("scan_week", week)
      .eq("kind", kind)
      .maybeSingle();
    if (data?.payload != null) return { value: data.payload as T, fromCache: true };
  } catch (_e) {
    // cache read failure → fall through to live fetch
  }
  const value = await fetcher();
  try {
    await sb.from("market_intel_cache").upsert(
      { market: m, scan_week: week, kind, payload: value as never, fetched_at: new Date().toISOString() },
      { onConflict: "market,scan_week,kind" },
    );
  } catch (_e) {
    // cache write failure is non-fatal
  }
  return { value, fromCache: false };
}

/**
 * Keyed-merge variant: payload is a Record<key, V>. Only MISSING keys are
 * fetched and deep-merged back — different brands' competitor sets in the same
 * market accumulate additively (cross-brand dedupe of provider spend).
 */
export async function getOrFetchMarketIntelKeyed<V>(
  sb: SupabaseClient,
  market: string,
  kind: string,
  keys: string[],
  fetchMissing: (missing: string[]) => Promise<Record<string, V>>,
): Promise<Record<string, V>> {
  const week = currentScanWeek();
  const m = (market || "global").toLowerCase();
  const wanted = [...new Set(keys.map((k) => k.toLowerCase().trim()).filter(Boolean))];
  let existing: Record<string, V> = {};
  try {
    const { data } = await sb
      .from("market_intel_cache")
      .select("payload")
      .eq("market", m)
      .eq("scan_week", week)
      .eq("kind", kind)
      .maybeSingle();
    if (data?.payload && typeof data.payload === "object") {
      existing = data.payload as Record<string, V>;
    }
  } catch (_e) {
    // fall through
  }
  const missing = wanted.filter((k) => !(k in existing));
  if (missing.length === 0) return existing;
  let fetched: Record<string, V> = {};
  try {
    fetched = await fetchMissing(missing);
  } catch (_e) {
    return existing; // live fetch failed → serve what we have
  }
  const merged = { ...existing, ...fetched };
  try {
    await sb.from("market_intel_cache").upsert(
      { market: m, scan_week: week, kind, payload: merged as never, fetched_at: new Date().toISOString() },
      { onConflict: "market,scan_week,kind" },
    );
  } catch (_e) {
    // non-fatal
  }
  return merged;
}
