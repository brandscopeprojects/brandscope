import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";
import {
  getBrandCompetitors,
  competitorNameMap,
  latestScanWeek,
} from "@/lib/data/competitors";
import type { Json } from "@/types/database.types";

export { getCurrentBrand, type BrandSummary } from "@/lib/data/brand";

// Hiring & Signals — Screen 13 (`/hiring-signals`). Reads the per-competitor
// `hiring_signals_cache` (DataForSEO Google Jobs SERP, cron-populated) for the
// latest scan_week.
//
// MVP POLICY — PARTIAL COVERAGE (mvp-constraints.md module 9): the only source is
// the Google Jobs SERP (~70% coverage). There is NO career-page crawl and NO full
// job-description text — so we surface job *titles*, locations, categories and the
// strategic signals interpreted from them, and we never imply full coverage. The
// screen-specs "Primary data source" cell mentions Firecrawl / hiring_intelligence;
// those are Phase-2/excluded — the real table is `hiring_signals_cache`.

// ── JSONB contracts (Sprint-3 WRITE TARGETS) ─────────────────────────────────
// These describe the jsonb columns the Hiring Researcher (Step 23, Jobs SERP)
// will write. The reader parses them defensively (cast `Json as`, validate each
// field) so a malformed/partial row degrades gracefully rather than throwing.

/** One detected open role. `hiring_signals_cache.roles` is `HiringRole[]`. */
export type HiringRole = {
  title: string;
  location?: string | null;
  /** ISO date/datetime the posting was first seen (rendered mono). */
  postedAt?: string | null;
  /** Coarse role grouping, e.g. "Engineering", "Marketing", "Compliance". */
  category?: string | null;
};

/** A strategic read of the hiring pattern.
 *  `hiring_signals_cache.interpreted_signals` is `InterpretedSignal[]`. */
export type InterpretedSignal = {
  /** Short headline, e.g. "Scaling paid-acquisition team". */
  signal: string;
  /** Why the role pattern implies this (plain language, references the roles). */
  rationale: string;
  /** Strategic weight. Aggressive/competitive hiring → treat high as a watch/urgent. */
  impact?: "high" | "medium" | "low";
};

/** Where a competitor appears to be expanding, by role volume.
 *  `hiring_signals_cache.geographic_expansion` is `GeographicExpansion[]`. */
export type GeographicExpansion = {
  market: string;
  roleCount: number;
};

// ── view models ──────────────────────────────────────────────────────────────

/** One competitor's hiring signals for the latest scan week, name-resolved. */
export type CompetitorHiringSignals = {
  competitorId: string;
  name: string;
  tier: string | null;
  /** Coarse signal-type tags (e.g. "expansion", "tech-hiring"), as chips. */
  signalTypes: string[];
  roles: HiringRole[];
  interpretedSignals: InterpretedSignal[];
  geographicExpansion: GeographicExpansion[];
};

/** A single role row flattened across competitors for the timeline. */
export type HiringRoleRow = HiringRole & {
  competitorId: string;
  competitorName: string;
};

/** A single interpreted-signal row flattened across competitors for the panel. */
export type HiringSignalRow = InterpretedSignal & {
  competitorId: string;
  competitorName: string;
  signalTypes: string[];
};

/** An aggregated market → role-count row for the expansion summary. */
export type HiringExpansionRow = {
  market: string;
  roleCount: number;
};

export type HiringSignalsData = {
  scanWeek: string;
  competitors: CompetitorHiringSignals[];
  /** Flattened interpreted signals (high-impact first) for the signal panel. */
  signals: HiringSignalRow[];
  /** Flattened role postings (most recent first) for the timeline. */
  roles: HiringRoleRow[];
  /** Aggregated geographic expansion (market → total role count), desc. */
  expansion: HiringExpansionRow[];
  // Real counts for the StatStrip — no fabricated numbers.
  openRoles: number;
  competitorsHiring: number;
  marketsExpanding: number;
};

// ── defensive parsers ────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function impact(v: unknown): "high" | "medium" | "low" | undefined {
  return v === "high" || v === "medium" || v === "low" ? v : undefined;
}

function asArray(v: Json | null | undefined): unknown[] {
  return Array.isArray(v) ? v : [];
}

function parseRoles(v: Json | null | undefined): HiringRole[] {
  return asArray(v)
    .map((r): HiringRole | null => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const title = str(o.title);
      if (!title) return null;
      return {
        title,
        location: str(o.location),
        postedAt: str(o.postedAt),
        category: str(o.category),
      };
    })
    .filter((r): r is HiringRole => r !== null);
}

function parseSignals(v: Json | null | undefined): InterpretedSignal[] {
  return asArray(v)
    .map((s): InterpretedSignal | null => {
      if (!s || typeof s !== "object") return null;
      const o = s as Record<string, unknown>;
      const signal = str(o.signal);
      const rationale = str(o.rationale);
      if (!signal || !rationale) return null;
      return { signal, rationale, impact: impact(o.impact) };
    })
    .filter((s): s is InterpretedSignal => s !== null);
}

function parseExpansion(v: Json | null | undefined): GeographicExpansion[] {
  return asArray(v)
    .map((e): GeographicExpansion | null => {
      if (!e || typeof e !== "object") return null;
      const o = e as Record<string, unknown>;
      const market = str(o.market);
      const roleCount =
        typeof o.roleCount === "number" && Number.isFinite(o.roleCount)
          ? o.roleCount
          : null;
      if (!market || roleCount === null) return null;
      return { market, roleCount };
    })
    .filter((e): e is GeographicExpansion => e !== null);
}

function parseSignalTypes(v: string[] | null | undefined): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.length > 0) : [];
}

/** Sort key: high → medium → low → none. */
const IMPACT_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
function impactRank(i: InterpretedSignal["impact"]): number {
  return i ? IMPACT_RANK[i] : 3;
}

/**
 * Latest `hiring_signals_cache` snapshot for the brand, mapped to view models.
 * `hiring_signals_cache` is PER-COMPETITOR (brand_id + competitor_id + scan_week):
 * we fetch every row for the brand, pick the most recent scan_week, filter to it,
 * and resolve competitor_id → display name/tier via brand_competitors. Returns
 * null when no scan cache exists yet (pre-first-scan empty state — no fake data).
 */
export async function getHiringSignalsData(
  brand: BrandSummary,
): Promise<HiringSignalsData | null> {
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("hiring_signals_cache")
    .select(
      "competitor_id, scan_week, signal_types, roles, interpreted_signals, geographic_expansion",
    )
    .eq("brand_id", brand.id);

  if (!rows || rows.length === 0) return null;

  const scanWeek = latestScanWeek(rows);
  if (!scanWeek) return null;

  const latest = rows.filter((r) => r.scan_week === scanWeek);
  if (latest.length === 0) return null;

  const brandCompetitors = await getBrandCompetitors(brand.id);
  const nameMap = competitorNameMap(brandCompetitors);
  const tierMap = new Map(brandCompetitors.map((c) => [c.id, c.tier]));

  const competitors: CompetitorHiringSignals[] = latest
    // Only surface rows we can resolve to a tracked competitor name.
    .filter((r) => nameMap.has(r.competitor_id))
    .map((r) => ({
      competitorId: r.competitor_id,
      name: nameMap.get(r.competitor_id) ?? r.competitor_id,
      tier: tierMap.get(r.competitor_id) ?? null,
      signalTypes: parseSignalTypes(r.signal_types),
      roles: parseRoles(r.roles),
      interpretedSignals: parseSignals(r.interpreted_signals),
      geographicExpansion: parseExpansion(r.geographic_expansion),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (competitors.length === 0) return null;

  // Flatten interpreted signals (high-impact first, then by competitor).
  const signals: HiringSignalRow[] = competitors
    .flatMap((c) =>
      c.interpretedSignals.map((s) => ({
        ...s,
        competitorId: c.competitorId,
        competitorName: c.name,
        signalTypes: c.signalTypes,
      })),
    )
    .sort((a, b) => {
      const r = impactRank(a.impact) - impactRank(b.impact);
      return r !== 0 ? r : a.competitorName.localeCompare(b.competitorName);
    });

  // Flatten role postings (most recent postedAt first; undated last, stable by name).
  const roles: HiringRoleRow[] = competitors
    .flatMap((c) =>
      c.roles.map((role) => ({
        ...role,
        competitorId: c.competitorId,
        competitorName: c.name,
      })),
    )
    .sort((a, b) => {
      const at = a.postedAt ? Date.parse(a.postedAt) : NaN;
      const bt = b.postedAt ? Date.parse(b.postedAt) : NaN;
      const aValid = !Number.isNaN(at);
      const bValid = !Number.isNaN(bt);
      if (aValid && bValid) return bt - at;
      if (aValid) return -1;
      if (bValid) return 1;
      return a.competitorName.localeCompare(b.competitorName);
    });

  // Aggregate geographic expansion by market across competitors.
  const expansionMap = new Map<string, number>();
  for (const c of competitors) {
    for (const e of c.geographicExpansion) {
      expansionMap.set(e.market, (expansionMap.get(e.market) ?? 0) + e.roleCount);
    }
  }
  const expansion: HiringExpansionRow[] = Array.from(expansionMap.entries())
    .map(([market, roleCount]) => ({ market, roleCount }))
    .sort((a, b) => b.roleCount - a.roleCount || a.market.localeCompare(b.market));

  return {
    scanWeek,
    competitors,
    signals,
    roles,
    expansion,
    openRoles: roles.length,
    competitorsHiring: competitors.filter((c) => c.roles.length > 0).length,
    marketsExpanding: expansion.length,
  };
}
