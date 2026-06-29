// EvidenceDrawer — first-class evidence chain, never a debug panel (ui-constraints §9).
// Collapsed by default: [🔍 Evidence — source · date · confidence].
// Expanded shows, IN THIS ORDER: source URL (cobalt link, mono) → scrapedAt (mono, muted)
// → extractedText (quote-styled block) → before/after change (only if present).
// Controlled component: parent owns `expanded` and `onToggle`.

import type { EvidenceItem } from "@/types/view-models";

// Render an ISO timestamp as a stable, readable evidence value (mono).
function formatScrapedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

// Pretty host for the collapsed summary line.
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function EvidenceRecord({ item }: { item: EvidenceItem }) {
  const hasChange =
    (item.changeBefore ?? null) !== null || (item.changeAfter ?? null) !== null;

  return (
    <div className="space-y-2 border-t border-divider pt-3 first:border-t-0 first:pt-0">
      {/* 1. Source URL — cobalt link, mono */}
      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block break-all font-mono text-xs text-cobalt hover:underline"
      >
        {item.sourceUrl}
      </a>

      {/* 2. Scrape timestamp — mono, muted */}
      <p className="font-mono text-[11px] text-ink-faint">
        Scraped {formatScrapedAt(item.scrapedAt)}
      </p>

      {/* 3. Verbatim extracted text — quote-styled block */}
      <blockquote className="border-l-2 border-divider bg-base-secondary px-3 py-2 text-xs italic text-ink-secondary">
        {item.extractedText}
      </blockquote>

      {/* 4. Before / after change — only if present */}
      {hasChange && (
        <div className="space-y-1 text-xs">
          {(item.changeBefore ?? null) !== null && (
            <p>
              <span className="font-medium text-ink-secondary">Before: </span>
              <span className="font-mono text-ink line-through">
                {item.changeBefore}
              </span>
            </p>
          )}
          {(item.changeAfter ?? null) !== null && (
            <p>
              <span className="font-medium text-ink-secondary">After: </span>
              <span className="font-mono text-ink">{item.changeAfter}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function EvidenceDrawer({
  evidence,
  expanded,
  onToggle,
}: {
  evidence: EvidenceItem[];
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!evidence || evidence.length === 0) return null;

  const first = evidence[0];
  // Collapsed summary: source · date · confidence-style metadata.
  const summary = `${hostOf(first.sourceUrl)} · ${formatScrapedAt(first.scrapedAt)}`;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 text-left text-xs text-ink-secondary transition-colors hover:text-ink"
      >
        <span aria-hidden="true">🔍</span>
        <span className="font-medium">Evidence</span>
        <span className="text-ink-faint">—</span>
        <span className="truncate font-mono text-[11px] text-ink-faint">
          {summary}
        </span>
        {evidence.length > 1 && (
          <span className="font-mono text-[11px] text-ink-faint">
            +{evidence.length - 1}
          </span>
        )}
        <span aria-hidden="true" className="ml-auto text-ink-faint">
          {expanded ? "▴" : "▾"}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {evidence.map((item, i) => (
            <EvidenceRecord key={item.evidenceHash ?? i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
