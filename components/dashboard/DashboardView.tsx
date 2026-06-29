// DashboardView — the populated split-field dashboard (ui-constraints §5).
// Extracted so both the live page (app/(app)/dashboard) and the public design
// preview (app/preview/dashboard) render the SAME real components — no drift.
// LEFT ~55% = positioning visuals; RIGHT ~45% = the action feed.

import type { DashboardData } from "@/lib/data/dashboard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ActionFeed } from "@/components/dashboard/ActionFeed";
import { ScatterMap } from "@/components/ui/ScatterMap";
import { CompetitiveRadar } from "@/components/ui/CompetitiveRadar";
import { SOVDonut } from "@/components/ui/SOVDonut";
import { ThreatGauge } from "@/components/ui/ThreatGauge";

function VizCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={["rounded-card bg-card p-5 shadow-sh1", className].filter(Boolean).join(" ")}
    >
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function EmptyViz({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center rounded-chip border border-dashed border-divider px-4 text-center text-sm text-ink-secondary">
      {message}
    </div>
  );
}

export function DashboardView({
  brandName,
  markets,
  data,
}: {
  brandName: string;
  markets: string[];
  data: DashboardData;
}) {
  const { scatter, radar, sov, threat, aiVisibility, recommendations, scanWeek } = data;

  return (
    <>
      <DashboardHeader
        brandName={brandName}
        markets={markets}
        scanWeek={scanWeek}
        aiVisibility={aiVisibility}
      />

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        {/* LEFT ~55% — positioning visuals */}
        <div className="flex flex-col gap-6 lg:w-[55%]">
          <VizCard title="Market position">
            <div className="h-[360px]">
              <ScatterMap brand={scatter.brand} competitors={scatter.competitors} />
            </div>
          </VizCard>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <VizCard title="Competitive radar">
              <div className="h-[340px]">
                {radar ? (
                  <CompetitiveRadar data={radar} />
                ) : (
                  <EmptyViz message="Radar appears once this week's scan completes." />
                )}
              </div>
            </VizCard>

            <VizCard title="Share of voice">
              <div className="h-[340px]">
                {sov.length > 0 ? (
                  <SOVDonut slices={sov} />
                ) : (
                  <EmptyViz message="Share of voice appears after the first scan." />
                )}
              </div>
            </VizCard>
          </div>

          <VizCard title="Competitive threat">
            {threat ? (
              <ThreatGauge data={threat} />
            ) : (
              <EmptyViz message="Threat level appears once competitor signals are scored." />
            )}
          </VizCard>
        </div>

        {/* RIGHT ~45% — action feed */}
        <div className="lg:w-[45%]">
          <div className="lg:sticky lg:top-6">
            <ActionFeed recommendations={recommendations} />
          </div>
        </div>
      </div>
    </>
  );
}
