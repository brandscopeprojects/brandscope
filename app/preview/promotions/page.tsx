// Public design preview of Promotion Signals (#3), populated with the RiversBet
// sample data so the real components are visible. No auth/Supabase. Mirrors the
// composition of app/(app)/promotions/page.tsx with DEMO_PROMOTIONS.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { PromotionsSignalsTable } from "@/components/intelligence/PromotionsSignalsTable";
import { DEMO_PROMOTIONS } from "@/lib/data/demo/promotions";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "Competitor promotion activity detected this week — signals only, not exact bonus terms.";

export default function PreviewPromotions() {
  const { scanWeek, signals, activeCount, newCount, competitorsWithPromos } =
    DEMO_PROMOTIONS;

  const stats: Stat[] = [
    { label: "Active promos detected", value: activeCount },
    { label: "New this week", value: newCount },
    { label: "Competitors with promos", value: competitorsWithPromos },
  ];

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
        <div className="space-y-6">
          <PageHeader
            title="Promotion Signals"
            subtitle={SUBTITLE}
            scanWeek={scanWeek}
          />

          <StatStrip stats={stats} />

          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold text-ink">
                Detected promotion signals
              </h2>
              <p className="text-xs text-ink-secondary">
                Promotions parsed from competitor pages this week, with new flags
                and week-over-week change direction.
              </p>
            </div>

            <PromotionsSignalsTable rows={signals} />

            <p className="text-xs leading-5 text-ink-faint">
              Exact bonus and wagering terms are intentionally not shown — these
              are detected signals (promo exists, its type, whether it is new, and
              the direction of any week-over-week change), not a tracker of exact
              offer values.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
