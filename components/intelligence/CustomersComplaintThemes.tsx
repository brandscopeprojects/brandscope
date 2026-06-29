// CustomersComplaintThemes — Screen 11 (Customer Intelligence). Per-competitor
// complaint themes mined from app reviews (DataForSEO), rendered as a compact
// heat list: each theme is a chip showing the theme + its mention count, tinted
// by the theme's sentiment (red = strongly negative, amber = mildly negative,
// neutral grey otherwise). Green is reserved for genuinely positive states only
// (ui-constraints §2.3/§15) — complaint themes are negative by nature, so the
// brightest a chip gets is neutral; we never colour a complaint green.
// Presentational; data from SSR props. Tokens only (no hex).

import type { CompetitorCustomerIntel } from "@/lib/data/customers";
import { TierBadge } from "@/components/intelligence/TierBadge";

// Sentiment is normalised to -1..1 by the populator. More-negative themes tint
// stronger toward urgent; mildly negative tint toward watch; everything else
// (including null) stays neutral grey. We never tint a complaint green.
function themeTint(sentiment: number | null): string {
  if (sentiment != null && sentiment <= -0.4) return "bg-urgent/10 text-urgent";
  if (sentiment != null && sentiment < 0) return "bg-watch/10 text-watch";
  return "bg-base-secondary text-ink-secondary";
}

function CompetitorThemes({ c }: { c: CompetitorCustomerIntel }) {
  return (
    <div className="rounded-card bg-card p-4 shadow-sh1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{c.name}</span>
        <TierBadge tier={c.tier} />
        {c.appReviewCount != null && (
          <span className="font-mono text-[11px] text-ink-faint">
            {c.appReviewCount.toLocaleString()} reviews
          </span>
        )}
      </div>

      {c.complaintThemes.length === 0 ? (
        <p className="mt-3 text-sm text-ink-faint">
          No complaint themes surfaced in this week&rsquo;s reviews.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {c.complaintThemes.map((t) => (
            <li
              key={t.theme}
              className={`inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-medium ${themeTint(
                t.sentiment,
              )}`}
            >
              <span>{t.theme}</span>
              <span className="font-mono text-[11px] opacity-80">{t.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CustomersComplaintThemes({
  competitors,
}: {
  competitors: CompetitorCustomerIntel[];
}) {
  const withThemes = competitors.filter((c) => c.complaintThemes.length > 0);

  if (withThemes.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-divider bg-card/50 px-4 py-8 text-center text-sm text-ink-secondary">
        Complaint themes appear once DataForSEO returns app reviews for your competitors.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {withThemes.map((c) => (
        <CompetitorThemes key={c.competitorId} c={c} />
      ))}
    </div>
  );
}
