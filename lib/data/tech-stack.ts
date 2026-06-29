import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand } from "@/lib/data/brand";
import {
  getBrandCompetitors,
  latestScanWeek,
  type BrandCompetitor,
} from "@/lib/data/competitors";

// Tech Stack & Ad Network Intelligence data layer (Screen 9, /tech-stack).
// Source: tech_stack_cache (DetectZeStack), cron-populated. IMPORTANT:
// tech_stack_cache has NO brand_id — it keys by competitor_id only. We resolve
// the brand's tracked competitors via brand_competitors (RLS-scoped), then read
// the cache .in("competitor_id", ids) and filter to the latest scan_week.

/** Shape of the `technologies` JSONB column (Sprint-3 WRITE TARGET).
 *  DetectZeStack returns a flat list of detected technologies with a category. */
export type DetectedTechnology = {
  name: string;
  category: string;
};

/** Shape of the `changes_detected` JSONB column (Sprint-3 WRITE TARGET).
 *  Between-cycle diff of the competitor's stack vs the previous scan. */
export type TechStackChange = {
  type: "added" | "removed";
  technology: string;
  detectedAt: string;
};

/** One competitor's detected tech stack for the latest scan week. */
export type CompetitorTechStack = {
  competitorId: string;
  name: string;
  tier: string | null;
  adNetworks: string[];
  analyticsTools: string[];
  cdnProviders: string[];
  crmTools: string[];
  paymentGateways: string[];
  technologies: DetectedTechnology[];
  /** Total distinct technologies detected (sum of all category lists). */
  technologyCount: number;
  changes: TechStackChange[];
  scannedAt: string | null;
};

/** A flattened recent-change entry (competitor-attributed) for the changes feed. */
export type TechStackChangeEntry = TechStackChange & {
  competitorId: string;
  competitorName: string;
};

export type TechStackData = {
  scanWeek: string;
  competitors: CompetitorTechStack[];
  changes: TechStackChangeEntry[];
  totals: {
    competitorsScanned: number;
    adNetworks: number;
    technologies: number;
  };
};

const asStringArray = (v: string[] | null): string[] => v ?? [];

const asTechnologies = (v: unknown): DetectedTechnology[] =>
  Array.isArray(v) ? (v as DetectedTechnology[]) : [];

const asChanges = (v: unknown): TechStackChange[] =>
  Array.isArray(v) ? (v as TechStackChange[]) : [];

/** Latest tech_stack_cache for the brand's competitors, mapped to view models.
 *  Returns null when no cache rows exist yet (pre-first-scan empty state). */
export async function getTechStackData(): Promise<TechStackData | null> {
  const brand = await getCurrentBrand();
  if (!brand) return null;

  const competitors = await getBrandCompetitors(brand.id);
  if (competitors.length === 0) return null;

  const byId = new Map<string, BrandCompetitor>(competitors.map((c) => [c.id, c]));
  const ids = competitors.map((c) => c.id);

  const supabase = createClient();
  const { data: rows } = await supabase
    .from("tech_stack_cache")
    .select(
      "competitor_id, scan_week, ad_networks, analytics_tools, cdn_providers, crm_tools, payment_gateways, technologies, changes_detected, scanned_at",
    )
    .in("competitor_id", ids);

  const scanWeek = latestScanWeek(rows ?? null);
  if (!rows || rows.length === 0 || !scanWeek) return null;

  const latest = rows.filter((r) => r.scan_week === scanWeek);

  const mapped: CompetitorTechStack[] = latest
    .map((r): CompetitorTechStack | null => {
      const comp = byId.get(r.competitor_id);
      if (!comp) return null;

      const adNetworks = asStringArray(r.ad_networks);
      const analyticsTools = asStringArray(r.analytics_tools);
      const cdnProviders = asStringArray(r.cdn_providers);
      const crmTools = asStringArray(r.crm_tools);
      const paymentGateways = asStringArray(r.payment_gateways);
      const technologies = asTechnologies(r.technologies);

      // Distinct count across every detected-technology surface.
      const all = new Set<string>([
        ...adNetworks,
        ...analyticsTools,
        ...cdnProviders,
        ...crmTools,
        ...paymentGateways,
        ...technologies.map((t) => t.name),
      ]);

      return {
        competitorId: r.competitor_id,
        name: comp.name,
        tier: comp.tier,
        adNetworks,
        analyticsTools,
        cdnProviders,
        crmTools,
        paymentGateways,
        technologies,
        technologyCount: all.size,
        changes: asChanges(r.changes_detected),
        scannedAt: r.scanned_at,
      };
    })
    .filter((c): c is CompetitorTechStack => c !== null)
    // Preserve onboarding priority order.
    .sort((a, b) => {
      const pa = byId.get(a.competitorId)?.priority ?? 0;
      const pb = byId.get(b.competitorId)?.priority ?? 0;
      return pa - pb;
    });

  if (mapped.length === 0) return null;

  const changes: TechStackChangeEntry[] = mapped
    .flatMap((c) =>
      c.changes.map((ch) => ({
        ...ch,
        competitorId: c.competitorId,
        competitorName: c.name,
      })),
    )
    // Most-recent change first.
    .sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : a.detectedAt > b.detectedAt ? -1 : 0));

  const totals = {
    competitorsScanned: mapped.length,
    adNetworks: new Set(mapped.flatMap((c) => c.adNetworks)).size,
    technologies: new Set(
      mapped.flatMap((c) => [
        ...c.adNetworks,
        ...c.analyticsTools,
        ...c.cdnProviders,
        ...c.crmTools,
        ...c.paymentGateways,
        ...c.technologies.map((t) => t.name),
      ]),
    ).size,
  };

  return { scanWeek, competitors: mapped, changes, totals };
}
