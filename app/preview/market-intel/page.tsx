// Public design preview of Market Intelligence (#6), populated with the RiversBet
// sample dataset. No auth/Supabase — renders the SAME components as the real
// /market-intel page against DEMO_MARKET_INTEL. For review/demo only.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { MarketTrendFeed } from "@/components/intelligence/MarketTrendFeed";
import { ScatterMap } from "@/components/ui/ScatterMap";
import { DEMO_MARKET_INTEL } from "@/lib/data/demo/market-intel";

export const dynamic = "force-dynamic";

export default function PreviewMarketIntel() {
  const { scanWeek, scatter, changes, competitorsTracked } = DEMO_MARKET_INTEL;

  const stats: Stat[] = [
    { label: "Competitors tracked", value: competitorsTracked },
    { label: "Recent changes", value: changes.length },
  ];
  if (scatter) {
    stats.push({
      label: "Players mapped",
      value: scatter.competitors.length + 1,
    });
  }

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
        <div className="space-y-6">
          <PageHeader
            title="Market Intelligence"
            subtitle="Where every player sits in your market, and what just changed."
            scanWeek={scanWeek}
          />

          <StatStrip stats={stats} />

          <section className="rounded-card bg-card p-5 shadow-sh1">
            <h3 className="mb-3 text-sm font-semibold text-ink">
              Market Position Map
            </h3>
            {scatter ? (
              <div className="h-[420px]">
                <ScatterMap
                  brand={scatter.brand}
                  competitors={scatter.competitors}
                />
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">What just changed</h3>
            <MarketTrendFeed changes={changes} />
          </section>
        </div>
      </div>
    </div>
  );
}
