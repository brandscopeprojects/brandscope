// RegulatoryViolationsFeed — the verbatim-evidence half of Screen 12
// (/regulatory). Lists compliance violations grouped by competitor. Each entry
// shows the dimension, a severity StatusPill, a plain-language description, the
// source URL (mono cobalt link, ui-constraints §9) and the verbatim extracted
// quote in a quote-styled block. This is the evidence chain that makes the
// compliance call defensible — built with the same care as primary content.
// Presentational. Tokens only.

import type { ViolationGroup, Violation } from "@/lib/data/regulatory";
import { StatusPill, type StatusTone } from "@/components/intelligence/StatusPill";

const SEVERITY_TONE: Record<Violation["severity"], StatusTone> = {
  high: "bad",
  medium: "warn",
  low: "neutral",
};

const SEVERITY_LABEL: Record<Violation["severity"], string> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

/** A dimension key like "age_verification" → "Age Verification". */
function prettifyDimension(dimension: string): string {
  return dimension
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function ViolationItem({ violation }: { violation: Violation }) {
  return (
    <li className="border-t border-divider px-5 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink">
          {prettifyDimension(violation.dimension)}
        </span>
        <StatusPill
          label={SEVERITY_LABEL[violation.severity]}
          tone={SEVERITY_TONE[violation.severity]}
        />
      </div>

      {violation.description && (
        <p className="mt-1.5 text-sm leading-6 text-ink-secondary">{violation.description}</p>
      )}

      {violation.quote && (
        <blockquote className="mt-3 rounded-chip border-l-2 border-divider bg-base-secondary px-3 py-2 font-mono text-[13px] leading-6 text-ink">
          “{violation.quote}”
        </blockquote>
      )}

      {violation.sourceUrl && (
        <a
          href={violation.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex max-w-full items-center gap-1 truncate font-mono text-xs text-cobalt hover:underline"
        >
          {violation.sourceUrl}
        </a>
      )}
    </li>
  );
}

export function RegulatoryViolationsFeed({ groups }: { groups: ViolationGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-divider bg-card/50 px-5 py-8 text-center text-sm text-ink-secondary">
        No compliance violations detected across your competitors this scan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section
          key={group.competitorId}
          className="overflow-hidden rounded-card bg-card shadow-sh1"
        >
          <header className="flex items-center justify-between gap-2 bg-base-secondary px-5 py-3">
            <h3 className="text-sm font-semibold text-ink">{group.competitorName}</h3>
            <span className="font-mono text-xs text-ink-faint">
              {group.violations.length}{" "}
              {group.violations.length === 1 ? "violation" : "violations"}
            </span>
          </header>
          <ul>
            {group.violations.map((v, i) => (
              <ViolationItem key={`${v.dimension}-${i}`} violation={v} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
