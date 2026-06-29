// Dashboard — the split-field decision surface (Sprint 5, step 37).
// Layout (ui-constraints §5): LEFT ~55% = positioning visuals (Scatter / Radar /
// SOV / Threat); RIGHT ~45% = the action feed. The left answers "where do I
// stand?"; the right answers "what do I do about it?".
//
// Auth: signed-in users only (middleware also gates). No brand yet → /onboarding.
// No scan cache yet (first scan still pending) → an honest "scan running" state,
// NOT fabricated numbers (CLAUDE.md: no fake data inside a v1 page).

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCurrentBrand, getDashboardData } from "@/lib/data/dashboard";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { ActionFeed } from "@/components/dashboard/ActionFeed";
import { ScatterMap } from "@/components/ui/ScatterMap";
import { CompetitiveRadar } from "@/components/ui/CompetitiveRadar";
import { SOVDonut } from "@/components/ui/SOVDonut";
import { ThreatGauge } from "@/components/ui/ThreatGauge";

export const dynamic = "force-dynamic";

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

export default async function DashboardPage() {
  await requireUser();

  const brand = await getCurrentBrand();
  if (!brand) redirect("/onboarding");

  const data = await getDashboardData(brand);

  // --- Pre-first-scan empty state (scan_jobs row is pending) ---
  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <DashboardHeader
          brandName={brand.name}
          markets={brand.market}
          scanWeek={null}
          aiVisibility={{ score: null, trend: null }}
        />
        <div className="mt-10 rounded-card bg-card p-8 text-center shadow-sh1">
          <div
            className="mx-auto mb-4 h-2.5 w-2.5 animate-brand-pulse rounded-full bg-cobalt"
            aria-hidden
          />
          <h2 className="font-display text-xl font-bold text-ink">
            Your first scan is running
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-secondary">
            We&apos;re analysing {brand.name} against your competitors across
            promotions, traffic, SEO, regulatory and AI visibility. Your
            evidence-backed action plan will appear here as soon as the weekly
            scan completes.
          </p>
        </div>
      </main>
    );
  }

  const { scatter, radar, sov, threat, aiVisibility, recommendations, scanWeek } = data;

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-8">
      <DashboardHeader
        brandName={brand.name}
        markets={brand.market}
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
    </main>
  );
}
