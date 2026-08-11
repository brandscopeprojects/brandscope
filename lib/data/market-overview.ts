import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BrandCompetitor } from "@/lib/data/competitors";

// Market Overview — the MARKET-WIDE half of Screen 4 (`/market-intel`).
//
// Sourced from `market_intel_cache`, which is keyed by (market, scan_week, kind)
// and holds RAW upstream provider data for the whole market (SERP leaders, search
// demand, Google-Trends interest, and each AI assistant's answer to
// "best betting sites in <market>"). Because it is market-scoped — NOT brand- or
// competitor-scoped — this view populates even when THIS brand's own weekly scan
// failed or was partial (the position-map scatter still needs a successful scan).
//
// ACCESS: `market_intel_cache` has RLS enabled with NO policy, so the RLS-scoped
// SSR client reads zero rows. We therefore read it with the service-role admin
// client, scoped IN CODE to the caller brand's own market. The data is global
// market context (not brand-private), so this is safe.

const AI_PLATFORMS = ["chatgpt", "claude", "gemini", "perplexity"] as const;
export type AiPlatform = (typeof AI_PLATFORMS)[number];

export type DemandLeader = { label: string; volume: number };
export type InterestPoint = { brand: string; score: number };
export type AiVisibility = {
  platform: AiPlatform;
  excerpt: string;
  mentionsTracked: boolean;
};

export type MarketOverview = {
  market: string;
  scanWeek: string;
  demandLeaders: DemandLeader[];
  interest: InterestPoint[];
  serpLeaders: string[];
  aiVisibility: AiVisibility[];
};

type CacheRow = { kind: string; scan_week: string; payload: unknown };

const AI_EXCERPT_LEN = 320;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** `{label: number}` → sorted `{label, volume}[]` (finite positives only). */
function toLeaders(payload: unknown): DemandLeader[] {
  if (!isRecord(payload)) return [];
  return Object.entries(payload)
    .map(([label, v]) => ({ label, volume: typeof v === "number" && Number.isFinite(v) ? v : 0 }))
    .filter((d) => d.volume > 0)
    .sort((a, b) => b.volume - a.volume);
}

/** `{brand: 0..100}` → sorted `{brand, score}[]`. */
function toInterest(payload: unknown): InterestPoint[] {
  if (!isRecord(payload)) return [];
  return Object.entries(payload)
    .map(([brand, v]) => ({ brand, score: typeof v === "number" && Number.isFinite(v) ? v : 0 }))
    .sort((a, b) => b.score - a.score);
}

/** Trim + collapse whitespace, strip markdown noise, cap length for a card. */
function excerpt(text: unknown): string {
  if (typeof text !== "string") return "";
  const clean = text.replace(/\s+/g, " ").replace(/[*#>\[\]]/g, "").trim();
  return clean.length > AI_EXCERPT_LEN ? `${clean.slice(0, AI_EXCERPT_LEN).trimEnd()}…` : clean;
}

/**
 * Market-wide overview for `market`, from the latest available scan_week in
 * `market_intel_cache`. Returns null only when the market has no cached rows.
 * `competitors` (the brand's tracked rivals) is used only to flag whether an AI
 * assistant named the brand or one of its competitors.
 */
export async function getMarketOverview(
  market: string,
  competitors: BrandCompetitor[],
): Promise<MarketOverview | null> {
  if (!market) return null;
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("market_intel_cache")
    .select("kind, scan_week, payload")
    .eq("market", market);

  const all = (rows ?? []) as CacheRow[];
  if (all.length === 0) return null;

  const scanWeek = all.reduce<string | null>(
    (max, r) => (max === null || r.scan_week > max ? r.scan_week : max),
    null,
  );
  if (!scanWeek) return null;

  const latest = all.filter((r) => r.scan_week === scanWeek);
  const byKind = new Map<string, unknown>();
  for (const r of latest) byKind.set(r.kind, r.payload);

  const demandLeaders = toLeaders(byKind.get("brand_demand")).slice(0, 12);
  const interest = toInterest(byKind.get("brand_trends"));
  const serpRaw = byKind.get("serp_betting");
  const serpLeaders = Array.isArray(serpRaw)
    ? (serpRaw.filter((d) => typeof d === "string") as string[])
    : [];

  // Deterministic "is my brand / a competitor named?" check — substring match on
  // tracked names + domains, no NLP.
  const needles = competitors
    .flatMap((c) => [c.name, c.domain])
    .filter((s): s is string => Boolean(s))
    .map((s) => s.toLowerCase());

  const aiVisibility: AiVisibility[] = AI_PLATFORMS.map((platform) => {
    const payload = byKind.get(`geo:${platform}`);
    // payload is `{query: answer}` — take the first answer.
    const answer = isRecord(payload) ? Object.values(payload)[0] : undefined;
    const ex = excerpt(answer);
    const hay = ex.toLowerCase();
    return {
      platform,
      excerpt: ex,
      mentionsTracked: needles.some((n) => n.length > 2 && hay.includes(n)),
    };
  }).filter((a) => a.excerpt.length > 0);

  // Nothing usable parsed → treat as no overview.
  if (
    demandLeaders.length === 0 &&
    interest.length === 0 &&
    serpLeaders.length === 0 &&
    aiVisibility.length === 0
  ) {
    return null;
  }

  return { market, scanWeek, demandLeaders, interest, serpLeaders, aiVisibility };
}
