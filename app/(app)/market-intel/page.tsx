// Market Intelligence — Screen 4 (`/market-intel`). The market-positioning
// surface: where every player sits (Market Position Map, reusing ScatterMap) and
// what just changed (MarketTrendFeed over competitor_changes). No
// `market_intelligence_cache` table exists — data comes from weekly_cache (via
// dashboard.ts) + competitor_changes (see lib/data/market-intel.ts).
//
// Auth: signed-in users only. No brand yet → /onboarding. No data at all (no
// weekly_cache AND no changes) → an honest empty state, never fabricated numbers
// (CLAUDE.md: no fake data inside a v1 page).

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCurrentBrand, getMarketIntelData } from "@/lib/data/market-intel";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { MarketTrendFeed } from "@/components/intelligence/MarketTrendFeed";
import { ScatterMap } from "@/components/ui/ScatterMap";

export const dynamic = "force-dynamic";

export default async function MarketIntelPage() {
  await requireUser();

  const brand = await getCurrentBrand();
  if (!brand) redirect("/onboarding");

  const { scanWeek, scatter, changes, competitorsTracked } =
    await getMarketIntelData(brand);

  const header = (
    <PageHeader
      title="Market Intelligence"
      subtitle="Where every player sits in your market, and what just changed."
      scanWeek={scanWeek}
    />
  );

  // No positioning data AND no recent moves → honest pre-first-scan empty state.
  if (!scatter && changes.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          title="No market data yet"
          message="Your first weekly scan will map the competitive landscape and start tracking competitor moves."
          intent="scanning"
        />
      </div>
    );
  }

  const stats: Stat[] = [
    { label: "Competitors tracked", value: competitorsTracked },
    { label: "Recent changes", value: changes.length },
  ];
  if (scatter) {
    stats.push({ label: "Players mapped", value: scatter.competitors.length + 1 });
  }

  return (
    <div className="space-y-6">
      {header}

      <StatStrip stats={stats} />

      <section className="rounded-card bg-card p-5 shadow-sh1">
        <h3 className="mb-3 text-sm font-semibold text-ink">
          Market Position Map
        </h3>
        {scatter ? (
          <div className="h-[420px]">
            <ScatterMap brand={scatter.brand} competitors={scatter.competitors} />
          </div>
        ) : (
          <EmptyState
            title="Position map pending"
            message="The competitive map appears once this week's scan scores every player's reach and aggression."
            intent="scanning"
          />
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-ink">What just changed</h3>
        <MarketTrendFeed changes={changes} />
      </section>
    </div>
  );
}
