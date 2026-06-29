// Hiring & Signals — Screen 13 (`/hiring-signals`). What competitor job postings
// reveal about their next moves. Source: hiring_signals_cache (DataForSEO Google
// Jobs SERP), cron-populated, keyed by brand_id + competitor_id + scan_week.
//
// MVP POLICY — PARTIAL COVERAGE (mvp-constraints.md module 9, ~70%): Google Jobs
// SERP only — no career-page crawl, no full job-description text. We surface role
// titles/locations/categories and the strategic signals interpreted from them,
// and we say "partial coverage" plainly. NOTE: the screen-specs "Primary data
// source" cell mentions Firecrawl/hiring_intelligence — those are Phase-2/excluded;
// the real table is hiring_signals_cache.
//
// Content-only — the (app) layout provides the shell and gates user + brand.
// No cache rows yet → honest EmptyState (CLAUDE.md: no fake data inside a v1 page).

import { redirect } from "next/navigation";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { HiringSignalPanel } from "@/components/intelligence/HiringSignalPanel";
import { HiringTimeline } from "@/components/intelligence/HiringTimeline";
import { HiringExpansion } from "@/components/intelligence/HiringExpansion";
import {
  getCurrentBrand,
  getHiringSignalsData,
} from "@/lib/data/hiring-signals";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "What competitor job postings reveal about their next moves (Google Jobs — partial coverage).";

const ROLE_CAP = 30;

export default async function HiringSignalsPage() {
  // The (app) layout already gates user + brand; getCurrentBrand is cache()'d, so
  // this reuses that query and narrows the type (and redirects defensively).
  const brand = await getCurrentBrand();
  if (!brand) redirect("/onboarding");

  const data = await getHiringSignalsData(brand);

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Hiring & Signals" subtitle={SUBTITLE} />
        <EmptyState
          title="No hiring signals yet"
          message="Your first scan will surface competitor job postings and the strategic signals they imply."
          intent="scanning"
        />
      </div>
    );
  }

  const { scanWeek, signals, roles, expansion } = data;

  // Real detected counts only — no fabricated figures.
  const stats: Stat[] = [
    { label: "Open roles detected", value: data.openRoles },
    { label: "Competitors hiring", value: data.competitorsHiring },
    { label: "Markets expanding", value: data.marketsExpanding },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Hiring & Signals" subtitle={SUBTITLE} scanWeek={scanWeek} />

      <StatStrip stats={stats} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">What their hiring implies</h2>
        <HiringSignalPanel signals={signals} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Open roles</h2>
        <HiringTimeline roles={roles} cap={ROLE_CAP} />
      </section>

      {expansion.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Where they&rsquo;re expanding</h2>
          <HiringExpansion rows={expansion} />
        </section>
      )}
    </div>
  );
}
