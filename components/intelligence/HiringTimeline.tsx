// HiringTimeline — the dated role-postings list for Hiring & Signals (Screen 13).
// One row per open role: title + competitor + location, a neutral category chip,
// and the posting date in JetBrains Mono (evidence). Source is the Google Jobs
// SERP (~70% coverage, no full JD text) — we show titles/locations only, never
// invented descriptions. Capped at `cap`; the parent notes truncation.
// Presentational; data arrives via SSR props. Tokens only.

import type { HiringRoleRow } from "@/lib/data/hiring-signals";

function formatPostedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function HiringTimeline({
  roles,
  cap = 30,
}: {
  roles: HiringRoleRow[];
  cap?: number;
}) {
  if (roles.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        No open roles detected in this week&rsquo;s scan.
      </p>
    );
  }

  const shown = roles.slice(0, cap);
  const truncated = roles.length - shown.length;

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {shown.map((r, i) => {
          const posted = formatPostedAt(r.postedAt);
          return (
            <li
              key={`${r.competitorId}-${i}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-card p-3.5 shadow-sh1"
            >
              <span className="text-sm font-semibold text-ink">{r.title}</span>
              <span className="text-sm text-ink-secondary">
                {r.competitorName}
              </span>
              {r.location && (
                <span className="text-sm text-ink-faint">{r.location}</span>
              )}
              {r.category && (
                <span className="inline-flex items-center rounded-chip bg-base-secondary px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide text-ink-secondary">
                  {r.category.replace(/[_-]+/g, " ").toUpperCase()}
                </span>
              )}
              {posted && (
                <span className="ml-auto font-mono text-xs text-ink-faint">
                  {posted}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {truncated > 0 && (
        <p className="font-mono text-xs text-ink-faint">
          + {truncated} more role{truncated === 1 ? "" : "s"} not shown
          (Google Jobs — partial coverage).
        </p>
      )}
    </div>
  );
}
