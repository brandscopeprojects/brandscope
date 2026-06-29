// MarketTrendFeed — the "what just changed" timeline for Market Intelligence
// (Screen 4). A dated list of competitor moves: each row carries the competitor
// name, a neutral change-type tag, an impact StatusPill (high→bad / medium→warn /
// low→neutral), the plain-language summary, an optional before→after detail, the
// scrape timestamp (mono) and an optional cobalt source link. Presentational;
// data arrives via SSR props. Tokens only — no hardcoded hex/fonts.

import { StatusPill, type StatusTone } from "@/components/intelligence/StatusPill";
import type { MarketChange } from "@/lib/data/market-intel";

const IMPACT_TONE: Record<string, StatusTone> = {
  high: "bad",
  medium: "warn",
  low: "neutral",
};

function impactTone(impact: string | null): StatusTone {
  if (!impact) return "neutral";
  return IMPACT_TONE[impact.toLowerCase()] ?? "neutral";
}

function changeTypeLabel(changeType: string): string {
  return changeType.replace(/[_-]+/g, " ").toUpperCase();
}

function formatDetectedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function MarketTrendFeed({ changes }: { changes: MarketChange[] }) {
  if (changes.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        No competitor moves detected yet. Between-cycle monitoring will surface
        changes here as soon as they happen.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {changes.map((c) => (
        <li
          key={c.id}
          className="rounded-card bg-card p-4 shadow-sh1"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">
              {c.competitorName}
            </span>
            <span className="inline-flex items-center rounded-chip bg-base-secondary px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide text-ink-secondary">
              {changeTypeLabel(c.changeType)}
            </span>
            {c.impactLevel && (
              <StatusPill
                label={`${c.impactLevel.toUpperCase()} IMPACT`}
                tone={impactTone(c.impactLevel)}
              />
            )}
            <span className="ml-auto font-mono text-xs text-ink-faint">
              {formatDetectedAt(c.detectedAt)}
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-ink-secondary">{c.summary}</p>

          {c.detail && (c.detail.before || c.detail.after) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-xs">
              {c.detail.metric && (
                <span className="text-ink-faint">{c.detail.metric}:</span>
              )}
              {c.detail.before && (
                <span className="rounded-chip bg-base-secondary px-2 py-0.5 text-ink-secondary line-through">
                  {c.detail.before}
                </span>
              )}
              {c.detail.before && c.detail.after && (
                <span aria-hidden className="text-ink-faint">
                  →
                </span>
              )}
              {c.detail.after && (
                <span className="rounded-chip bg-base-secondary px-2 py-0.5 text-ink">
                  {c.detail.after}
                </span>
              )}
            </div>
          )}

          {c.sourceUrl && (
            <a
              href={c.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block max-w-full truncate font-mono text-xs text-cobalt hover:underline"
            >
              {c.sourceUrl}
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
