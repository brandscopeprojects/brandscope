// Tech Stack & Ad Network Intelligence (Screen 9, /tech-stack).
// Source: tech_stack_cache (DetectZeStack), cron-populated, keyed by competitor_id.
// Content-only — the (app) layout provides the shell and gates user + brand.
//
// Sections (with data):
//   1. StatStrip — real detected counts only (NO fabricated spend; spend-intensity
//      scoring is Sprint 3, per the screen brief — we never invent spend numbers).
//   2. TechStackAdNetworkTable — ad networks + technology count per competitor.
//   3. TechStackTable — per-competitor technology-category breakdown.
//   4. TechStackChangesFeed — recent added/removed technologies (omitted if none).
// No cache rows yet → honest EmptyState (CLAUDE.md: no fake data inside a v1 page).

import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { TechStackAdNetworkTable } from "@/components/intelligence/TechStackAdNetworkTable";
import { TechStackTable } from "@/components/intelligence/TechStackTable";
import { TechStackChangesFeed } from "@/components/intelligence/TechStackChangesFeed";
import { getTechStackData } from "@/lib/data/tech-stack";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "Ad networks, analytics, payment and CRM technologies detected across your competitors (DetectZeStack).";

export default async function TechStackPage() {
  const data = await getTechStackData();

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tech Stack & Ad Network Intelligence" subtitle={SUBTITLE} />
        <EmptyState
          title="No tech-stack data yet"
          message="Your first scan will detect competitor ad networks and technologies via DetectZeStack."
          intent="scanning"
        />
      </div>
    );
  }

  const { scanWeek, competitors, changes, totals } = data;

  // Real detected counts only — never spend numbers (Sprint 3).
  const stats: Stat[] = [
    { label: "Competitors Scanned", value: totals.competitorsScanned },
    { label: "Ad Networks Detected", value: totals.adNetworks },
    { label: "Technologies Detected", value: totals.technologies },
    { label: "Recent Changes", value: changes.length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tech Stack & Ad Network Intelligence"
        subtitle={SUBTITLE}
        scanWeek={scanWeek}
      />

      <StatStrip stats={stats} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Ad networks</h2>
        <TechStackAdNetworkTable rows={competitors} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Technology breakdown</h2>
        <TechStackTable rows={competitors} />
      </section>

      {changes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Recent changes</h2>
          <TechStackChangesFeed changes={changes} />
        </section>
      )}
    </div>
  );
}
