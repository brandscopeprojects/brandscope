// CompetitorVerticalGrid — the Promotions tab's product-vertical status grid for
// a single competitor (Competitor Profile, Screen 5). Product/app-store data
// does NOT ship as a standalone /products page at MVP — it renders here, sourced
// from product_intel_cache. Each vertical (Sports/Casino/Crash/Lottery) gets a
// StatusPill mapped from its raw status string:
//   active / growing  → good (green positive)
//   declining / partial → warn (amber)
//   absent / inactive / null → neutral
// Plus: Aviator promo active flag, odds-competitiveness score, and any
// new-products-detected chips. Presentational; data via SSR props. Tokens only.

import { StatusPill, type StatusTone } from "@/components/intelligence/StatusPill";
import type {
  AviatorBonusStructure,
  VerticalStatus,
} from "@/lib/data/competitor-profile";

const STATUS_TONE: Record<string, StatusTone> = {
  active: "good",
  growing: "good",
  declining: "warn",
  partial: "warn",
  absent: "neutral",
  inactive: "neutral",
};

function verticalTone(status: string | null): StatusTone {
  if (!status) return "neutral";
  return STATUS_TONE[status.toLowerCase()] ?? "neutral";
}

function verticalLabel(status: string | null): string {
  if (!status) return "ABSENT";
  return status.replace(/[_-]+/g, " ").toUpperCase();
}

function aviatorBonusLine(bonus: AviatorBonusStructure | null): string | null {
  if (!bonus) return null;
  if (bonus.headline) return bonus.headline;
  const parts: string[] = [];
  if (bonus.promoType) parts.push(bonus.promoType.replace(/[_-]+/g, " "));
  if (bonus.wageringRequirement != null) {
    parts.push(`${bonus.wageringRequirement}x wagering`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function CompetitorVerticalGrid({
  verticals,
  aviatorPromoActive,
  aviatorBonus,
  oddsCompetitivenessScore,
  newProductsDetected,
}: {
  verticals: VerticalStatus[];
  aviatorPromoActive: boolean | null;
  aviatorBonus: AviatorBonusStructure | null;
  oddsCompetitivenessScore: number | null;
  newProductsDetected: string[];
}) {
  const bonusLine = aviatorBonusLine(aviatorBonus);

  return (
    <div className="space-y-5">
      {/* Vertical status grid. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {verticals.map((v) => (
          <div key={v.label} className="rounded-card bg-card p-4 shadow-sh1">
            <p className="text-xs text-ink-secondary">{v.label}</p>
            <div className="mt-2">
              <StatusPill label={verticalLabel(v.status)} tone={verticalTone(v.status)} />
            </div>
          </div>
        ))}
      </div>

      {/* Aviator / crash promo + odds competitiveness. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-card bg-card p-4 shadow-sh1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink">Aviator promo</p>
            <StatusPill
              label={aviatorPromoActive ? "ACTIVE" : "NONE DETECTED"}
              tone={aviatorPromoActive ? "good" : "neutral"}
            />
          </div>
          {aviatorPromoActive && bonusLine && (
            <p className="mt-2 font-mono text-xs text-ink-secondary">{bonusLine}</p>
          )}
        </div>

        <div className="rounded-card bg-card p-4 shadow-sh1">
          <p className="text-xs text-ink-secondary">Odds competitiveness</p>
          {oddsCompetitivenessScore != null ? (
            <p className="mt-1 font-display text-3xl font-bold leading-none text-ink">
              {oddsCompetitivenessScore}
              <span className="ml-0.5 text-lg text-ink-faint">/100</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-faint">Not scored this week.</p>
          )}
        </div>
      </div>

      {/* New products detected — chips. */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-ink">New products detected</h4>
        {newProductsDetected.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {newProductsDetected.map((p) => (
              <span
                key={p}
                className="inline-flex items-center rounded-chip bg-base-secondary px-2.5 py-1 text-xs font-medium text-ink-secondary"
              >
                {p}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-faint">
            No new products detected for this competitor this week.
          </p>
        )}
      </div>
    </div>
  );
}
