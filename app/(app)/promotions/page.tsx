// Promotion Signals — Screen 6 (`/promotions`). Reads the per-competitor
// `promotions_cache` (DataForSEO OnPage + Content parsing, cron-populated) for the
// latest scan_week and surfaces detected competitor promotion ACTIVITY.
//
// MVP POLICY (mvp-constraints.md module 8): titled "Promotion Signals", not a
// tracker. SIGNALS ONLY — we show that a promo exists, its type, whether it is
// new, and the direction of a WoW change. Exact bonus amounts and wagering
// requirements are intentionally NOT shown (the data layer withholds them).
//
// Auth + brand gating + the shell live in app/(app)/layout.tsx. Before the first
// scan populates promotions_cache, we render the honest "scanning" empty state —
// never fabricated numbers (CLAUDE.md: no fake data inside a v1 page).

import { getCurrentBrand } from "@/lib/data/brand";
import { getPromotionsData } from "@/lib/data/promotions";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { PromotionsSignalsTable } from "@/components/intelligence/PromotionsSignalsTable";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "Competitor promotion activity detected this week — signals only, not exact bonus terms.";

export default async function PromotionsPage() {
  const brand = await getCurrentBrand();
  // Layout already redirects when there's no brand; this satisfies the type and
  // guards a direct render.
  if (!brand) return null;

  const data = await getPromotionsData(brand);

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Promotion Signals" subtitle={SUBTITLE} />
        <EmptyState
          title="No promotion signals yet"
          message="Your first scan will surface competitor promotion activity from DataForSEO content parsing."
          intent="scanning"
        />
      </div>
    );
  }

  const { scanWeek, signals, activeCount, newCount, competitorsWithPromos } = data;

  const stats: Stat[] = [
    { label: "Active promos detected", value: activeCount },
    { label: "New this week", value: newCount },
    { label: "Competitors with promos", value: competitorsWithPromos },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Promotion Signals" subtitle={SUBTITLE} scanWeek={scanWeek} />

      <StatStrip stats={stats} />

      <section className="space-y-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-ink">Detected promotion signals</h2>
          <p className="text-xs text-ink-secondary">
            Promotions parsed from competitor pages this week, with new flags and
            week-over-week change direction.
          </p>
        </div>

        <PromotionsSignalsTable rows={signals} />

        <p className="text-xs leading-5 text-ink-faint">
          Exact bonus and wagering terms are intentionally not shown — these are
          detected signals (promo exists, its type, whether it is new, and the
          direction of any week-over-week change), not a tracker of exact offer values.
        </p>
      </section>
    </div>
  );
}
