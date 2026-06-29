import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand } from "@/lib/data/brand";
import {
  getBrandCompetitors,
  competitorNameMap,
  latestScanWeek,
  type BrandCompetitor,
} from "@/lib/data/competitors";
import { marketLabel } from "@/lib/format";
import { isDemoMode } from "@/lib/data/demo-mode";
import type { Json } from "@/types/database.types";

// Regulatory Compliance data layer (Screen 12, /regulatory).
// Source: regulatory_cache (Claude Sonnet RAG over NG/KE/ZA regulator docs),
// cron-populated. Unlike most per-competitor caches, regulatory_cache HAS a
// brand_id — we scope by brand_id (RLS also enforces this) and resolve each
// row's competitor_id → display name. Rows are keyed by
// brand_id + competitor_id + scan_week + market; we surface the latest scan_week.
//
// regulatory_documents is shared master data (RLS: readable by any signed-in
// user) scoped by `country`. We pull the active source documents for the brand's
// markets so the page can cite the regulator filings behind the compliance call.

/** The six regulatory dimensions scored per competitor, in display order.
 *  Keys match the `*_status` columns on regulatory_cache. */
export const REGULATORY_DIMENSIONS = [
  { key: "age_verification", label: "Age Verification" },
  { key: "licence_display", label: "Licence Display" },
  { key: "responsible_gambling", label: "Responsible Gambling" },
  { key: "bonus_terms", label: "Bonus Terms" },
  { key: "data_privacy", label: "Data Privacy" },
  { key: "withdrawal_terms", label: "Withdrawal Terms" },
] as const;

export type RegulatoryDimensionKey = (typeof REGULATORY_DIMENSIONS)[number]["key"];

/** Normalised compliance status for a single dimension. Unknown / missing source
 *  values map to "unknown" (rendered neutral — never fabricated as compliant). */
export type ComplianceStatus = "compliant" | "partial" | "missing" | "violation" | "unknown";

/**
 * Shape of the `violations` JSONB column on regulatory_cache (Sprint-3 WRITE
 * TARGET — the Regulatory Researcher writes this array). Each entry is one
 * concrete compliance gap with verbatim evidence pulled from the competitor's
 * site or a regulator filing.
 */
export type Violation = {
  dimension: string;
  severity: "high" | "medium" | "low";
  description: string;
  sourceUrl: string | null;
  quote: string | null;
};

/** One competitor's (or the own brand's) compliance posture for the scan week. */
export type ComplianceRow = {
  competitorId: string;
  name: string;
  tier: string | null;
  market: string;
  /** 0–100 overall compliance score, or null when not scored. */
  score: number | null;
  isOwnBrand: boolean;
  statuses: Record<RegulatoryDimensionKey, ComplianceStatus>;
};

/** A violation attributed to a competitor, for the grouped violations feed. */
export type ViolationEntry = Violation & {
  competitorId: string;
  competitorName: string;
};

/** Violations grouped under one competitor. */
export type ViolationGroup = {
  competitorId: string;
  competitorName: string;
  violations: Violation[];
};

/** An active regulator source document for one of the brand's markets. */
export type RegulatoryDocument = {
  id: string;
  documentName: string;
  documentType: string;
  regulatoryBody: string;
  country: string;
  sourceUrl: string;
  version: string | null;
  effectiveDate: string | null;
  lastVerifiedAt: string | null;
};

export type RegulatoryData = {
  scanWeek: string;
  /** Markets covered by the latest scan, in brand order. */
  markets: string[];
  /** Brand row first (own-brand), then competitor rows. */
  rows: ComplianceRow[];
  violations: ViolationGroup[];
  documents: RegulatoryDocument[];
  totals: {
    competitorsScored: number;
    avgCompetitorScore: number | null;
    openViolations: number;
  };
};

/** Map a raw `*_status` string from the cache to a normalised ComplianceStatus. */
function normaliseStatus(raw: string | null | undefined): ComplianceStatus {
  switch ((raw ?? "").toLowerCase().trim()) {
    case "compliant":
    case "pass":
    case "passed":
    case "ok":
      return "compliant";
    case "partial":
    case "warning":
    case "warn":
      return "partial";
    case "missing":
    case "absent":
    case "none":
      return "missing";
    case "violation":
    case "fail":
    case "failed":
    case "breach":
      return "violation";
    default:
      return "unknown";
  }
}

const asViolations = (v: Json | null): Violation[] => {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .map((raw): Violation | null => {
      if (typeof raw !== "object" || raw === null) return null;
      const o = raw as Record<string, unknown>;
      const dimension = typeof o.dimension === "string" ? o.dimension : "";
      if (!dimension) return null;
      const sev = typeof o.severity === "string" ? o.severity.toLowerCase() : "";
      const severity: Violation["severity"] =
        sev === "high" || sev === "medium" || sev === "low" ? sev : "medium";
      return {
        dimension,
        severity,
        description: typeof o.description === "string" ? o.description : "",
        sourceUrl: typeof o.sourceUrl === "string" ? o.sourceUrl : null,
        quote: typeof o.quote === "string" ? o.quote : null,
      };
    })
    .filter((x): x is Violation => x !== null);
};

/** Country aliases for one market value, used to match regulatory_documents.country
 *  (which may store full names or ISO codes, case-insensitively). */
const MARKET_COUNTRY_ALIASES: Record<string, string[]> = {
  nigeria: ["nigeria", "ng", "nga"],
  kenya: ["kenya", "ke", "ken"],
  south_africa: ["south africa", "south_africa", "za", "zaf", "rsa"],
};

function countryMatchesMarkets(country: string, markets: string[]): boolean {
  const c = country.toLowerCase().trim();
  return markets.some((m) => {
    const aliases = MARKET_COUNTRY_ALIASES[m] ?? [m.toLowerCase()];
    return aliases.includes(c) || aliases.some((a) => c === a);
  });
}

/** Latest regulatory_cache for the brand's competitors + the active regulator
 *  source docs for the brand's markets, mapped to view models. Returns null when
 *  no regulatory_cache rows exist yet (pre-first-scan empty state). */
export async function getRegulatoryData(): Promise<RegulatoryData | null> {
  if (isDemoMode()) {
    const { DEMO_REGULATORY } = await import("@/lib/data/demo/regulatory");
    return DEMO_REGULATORY;
  }

  const brand = await getCurrentBrand();
  if (!brand) return null;

  const competitors = await getBrandCompetitors(brand.id);
  const nameMap = competitorNameMap(competitors);
  const tierMap = new Map<string, BrandCompetitor>(competitors.map((c) => [c.id, c]));

  const supabase = createClient();

  const { data: rows } = await supabase
    .from("regulatory_cache")
    .select(
      "competitor_id, scan_week, market, compliance_score, age_verification_status, bonus_terms_status, data_privacy_status, licence_display_status, responsible_gambling_status, withdrawal_terms_status, violations",
    )
    .eq("brand_id", brand.id);

  const scanWeek = latestScanWeek(rows ?? null);
  if (!rows || rows.length === 0 || !scanWeek) return null;

  const latest = rows.filter((r) => r.scan_week === scanWeek);
  if (latest.length === 0) return null;

  const markets = Array.from(
    new Set(latest.map((r) => r.market).filter((m): m is string => !!m)),
  );

  // Build one ComplianceRow per cache row. A self-row (competitor_id === brand.id)
  // is treated as the own-brand row; otherwise we resolve the competitor name.
  const competitorRows: ComplianceRow[] = [];
  let brandRow: ComplianceRow | null = null;

  for (const r of latest) {
    const isOwnBrand = r.competitor_id === brand.id;
    const name = isOwnBrand ? brand.name : (nameMap.get(r.competitor_id) ?? null);
    // Skip cache rows for competitors no longer tracked by this brand.
    if (!isOwnBrand && name === null) continue;

    const row: ComplianceRow = {
      competitorId: r.competitor_id,
      name: name ?? brand.name,
      tier: isOwnBrand ? null : (tierMap.get(r.competitor_id)?.tier ?? null),
      market: r.market,
      score: r.compliance_score,
      isOwnBrand,
      statuses: {
        age_verification: normaliseStatus(r.age_verification_status),
        licence_display: normaliseStatus(r.licence_display_status),
        responsible_gambling: normaliseStatus(r.responsible_gambling_status),
        bonus_terms: normaliseStatus(r.bonus_terms_status),
        data_privacy: normaliseStatus(r.data_privacy_status),
        withdrawal_terms: normaliseStatus(r.withdrawal_terms_status),
      },
    };

    if (isOwnBrand) {
      brandRow = row;
    } else {
      competitorRows.push(row);
    }
  }

  // Order competitor rows by onboarding priority.
  const priority = new Map(competitors.map((c, i) => [c.id, c.priority ?? i]));
  competitorRows.sort(
    (a, b) => (priority.get(a.competitorId) ?? 0) - (priority.get(b.competitorId) ?? 0),
  );

  // If the cache has no self-row, synthesise a neutral own-brand row (all
  // "unknown") so the matrix anchors on the brand WITHOUT fabricating statuses.
  if (!brandRow) {
    brandRow = {
      competitorId: brand.id,
      name: brand.name,
      tier: null,
      market: markets[0] ?? "",
      score: null,
      isOwnBrand: true,
      statuses: {
        age_verification: "unknown",
        licence_display: "unknown",
        responsible_gambling: "unknown",
        bonus_terms: "unknown",
        data_privacy: "unknown",
        withdrawal_terms: "unknown",
      },
    };
  }

  const rowsOut: ComplianceRow[] = [brandRow, ...competitorRows];

  // Violations, grouped per competitor (own-brand violations included if scored).
  const groups: ViolationGroup[] = [];
  for (const r of latest) {
    const vs = asViolations(r.violations);
    if (vs.length === 0) continue;
    const isOwnBrand = r.competitor_id === brand.id;
    const name = isOwnBrand ? brand.name : nameMap.get(r.competitor_id);
    if (!name) continue;
    const existing = groups.find((g) => g.competitorId === r.competitor_id);
    if (existing) {
      existing.violations.push(...vs);
    } else {
      groups.push({ competitorId: r.competitor_id, competitorName: name, violations: vs });
    }
  }
  // Sort groups: most violations first, own brand last (focus is competitors).
  const SEV_WEIGHT: Record<Violation["severity"], number> = { high: 3, medium: 2, low: 1 };
  for (const g of groups) {
    g.violations.sort((a, b) => SEV_WEIGHT[b.severity] - SEV_WEIGHT[a.severity]);
  }
  groups.sort((a, b) => b.violations.length - a.violations.length);

  const openViolations = groups.reduce((sum, g) => sum + g.violations.length, 0);

  // Active regulator source documents for the brand's markets.
  const { data: docRows } = await supabase
    .from("regulatory_documents")
    .select(
      "id, document_name, document_type, regulatory_body, country, source_url, version, effective_date, last_verified_at, is_active",
    )
    .eq("is_active", true);

  const documents: RegulatoryDocument[] = (docRows ?? [])
    .filter((d) => countryMatchesMarkets(d.country, markets))
    .map((d) => ({
      id: d.id,
      documentName: d.document_name,
      documentType: d.document_type,
      regulatoryBody: d.regulatory_body,
      country: d.country,
      sourceUrl: d.source_url,
      version: d.version,
      effectiveDate: d.effective_date,
      lastVerifiedAt: d.last_verified_at,
    }));

  const scored = competitorRows.filter((r) => r.score != null);
  const avgCompetitorScore =
    scored.length > 0
      ? Math.round(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length)
      : null;

  return {
    scanWeek,
    markets,
    rows: rowsOut,
    violations: groups,
    documents,
    totals: {
      competitorsScored: scored.length,
      avgCompetitorScore,
      openViolations,
    },
  };
}

/** Display label for a market value (re-exported convenience for the page). */
export { marketLabel };
