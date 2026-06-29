// TechStackChangesFeed — recent stack changes detected across competitors on
// /tech-stack (Screen 9), a dated change list (ui-constraints §12 "activity /
// change timeline"). Added technologies use a positive (green) pill, removed use
// neutral; each row names the technology + competitor + detected timestamp (mono).
// Presentational. Tokens only.

import { StatusPill } from "@/components/intelligence/StatusPill";
import type { TechStackChangeEntry } from "@/lib/data/tech-stack";

// Render an ISO timestamp as a stable, readable evidence value (mono, UTC) —
// mirrors EvidenceDrawer so timestamps look identical across the app.
function formatDetectedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export function TechStackChangesFeed({ changes }: { changes: TechStackChangeEntry[] }) {
  return (
    <div className="rounded-card border border-divider bg-card">
      <ul className="divide-y divide-divider">
        {changes.map((change, i) => (
          <li
            key={`${change.competitorId}-${change.technology}-${change.detectedAt}-${i}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3"
          >
            <StatusPill
              label={change.type === "added" ? "Added" : "Removed"}
              tone={change.type === "added" ? "good" : "neutral"}
            />
            <span className="font-mono text-[13px] text-ink">{change.technology}</span>
            <span className="text-sm text-ink-secondary">{change.competitorName}</span>
            <span className="ml-auto font-mono text-xs text-ink-faint">
              {formatDetectedAt(change.detectedAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
