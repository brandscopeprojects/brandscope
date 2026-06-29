// CustomersDemographics — Screen 11 (Customer Intelligence). Inferred audience
// demographics (age / gender bands) for one selected competitor, as labelled
// horizontal bars. Customer Intelligence is a PARTIAL module (mvp-constraints
// §2): only inferred demographics ship. When no demographic inference exists for
// any competitor this week, the whole sub-section renders the Phase-2 EmptyState
// (full demographic + social-audience depth needs social intelligence) — never
// fabricated bars. Bars use the neutral grey ramp (these are competitors, not
// the own brand; cobalt is reserved and never decorative, ui-constraints §2.2).
// Presentational; data from SSR props. Tokens only.

import type {
  CompetitorCustomerIntel,
  DemographicBand,
} from "@/lib/data/customers";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { TierBadge } from "@/components/intelligence/TierBadge";

// Neutral grey ramp (mirrors the SOV donut / traffic chart convention).
const GREY_RAMP = ["#6B6B78", "#8A8A96", "#9999A8", "#B4B4BE", "#CBCBD2"];

function BandBars({
  title,
  bands,
}: {
  title: string;
  bands: DemographicBand[];
}) {
  if (bands.length === 0) return null;
  const max = Math.max(...bands.map((b) => b.pct), 1);
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink-secondary">{title}</p>
      <ul className="space-y-2">
        {bands.map((b, i) => (
          <li key={b.label} className="flex items-center gap-3">
            <span className="w-16 shrink-0 truncate text-xs text-ink">{b.label}</span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-base-secondary">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.max((b.pct / max) * 100, 2)}%`,
                  backgroundColor: GREY_RAMP[Math.min(i, GREY_RAMP.length - 1)],
                }}
                aria-hidden
              />
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-xs text-ink-secondary">
              {Math.round(b.pct)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompetitorDemographics({ c }: { c: CompetitorCustomerIntel }) {
  // Guarded by the parent: only competitors with demographics reach here.
  const demo = c.demographics!;
  return (
    <div className="rounded-card bg-card p-4 shadow-sh1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{c.name}</span>
        <TierBadge tier={c.tier} />
      </div>
      <div className="mt-3 space-y-4">
        <BandBars title="Age" bands={demo.ageBands} />
        <BandBars title="Gender" bands={demo.gender} />
      </div>
    </div>
  );
}

export function CustomersDemographics({
  competitors,
}: {
  competitors: CompetitorCustomerIntel[];
}) {
  const withDemographics = competitors.filter((c) => c.demographics !== null);

  // No inferred demographics for any competitor → the deferred sub-state.
  if (withDemographics.length === 0) {
    return (
      <EmptyState
        intent="phase2"
        title="Demographic depth"
        message="Full demographic and social-audience breakdowns require social intelligence — Phase 2."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {withDemographics.map((c) => (
        <CompetitorDemographics key={c.competitorId} c={c} />
      ))}
    </div>
  );
}
