// Tags — UrgencyTag + CategoryTag for the action-feed card status row
// (ui-constraints §7 status row, §8 tag systems).
// UrgencyTag: solid status-coloured background + white text (exactly four urgencies).
// CategoryTag: neutral grey chip — category tags are NEVER status-coloured (§8.1).
// Tokens only — no hardcoded hex/fonts.

import type { Urgency } from "@/types/view-models";

const URGENCY_LABEL: Record<Urgency, string> = {
  urgent: "URGENT",
  watch: "WATCH",
  opportunity: "OPPORTUNITY",
  info: "INFO",
};

// Solid fill per urgency. Info reuses the cobalt brand token here as a meaning-bearing
// status (ui-constraints §2.3 / §8.1), not as a decorative accent.
const URGENCY_BG: Record<Urgency, string> = {
  urgent: "bg-urgent",
  watch: "bg-watch",
  opportunity: "bg-opportunity",
  info: "bg-info",
};

export function UrgencyTag({ urgency }: { urgency: Urgency }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-chip px-2 py-0.5",
        "text-[11px] font-semibold uppercase tracking-wide text-white",
        URGENCY_BG[urgency],
      ].join(" ")}
    >
      {URGENCY_LABEL[urgency]}
    </span>
  );
}

// Humanise raw category slugs (e.g. 'traffic_seo' → 'Traffic SEO', 'geo_aeo' → 'Geo Aeo').
function formatCategory(category: string): string {
  return category
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CategoryTag({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-chip bg-base-secondary px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
      {formatCategory(category)}
    </span>
  );
}
