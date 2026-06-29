"use client";

// AssetsGrid — the library grid of asset tiles (Screen 16). Client component: it
// holds (a) the asset-type filter-chip state and (b) which card is expanded.
// Cards are passed real, already-mapped data via SSR props (no fetching here).
// Clicking a card toggles an INLINE preview of its content (AssetsPreview) — never
// a modal (ui-constraints §10). The grid stacks to one column on mobile.
// Tokens only — cobalt is reserved for the active filter chip (a primary control)
// and links; status colours never decorative.

import { useMemo, useState } from "react";
import type { AssetListItem } from "@/lib/data/assets";
import { StatusPill } from "@/components/intelligence/StatusPill";
import {
  AssetsTypeBadge,
  assetTypeLabel,
} from "@/components/intelligence/AssetsTypeBadge";
import { AssetsPreview } from "@/components/intelligence/AssetsPreview";

const ALL = "__all__";

function formatCreatedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function AssetsCard({
  asset,
  expanded,
  onToggle,
}: {
  asset: AssetListItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const previewId = `asset-preview-${asset.id}`;
  return (
    <div className="overflow-hidden rounded-card bg-card shadow-sh1">
      {/* Header / tile body — the whole top region toggles the inline preview. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={previewId}
        className="block w-full px-4 py-4 text-left transition-colors hover:bg-base-secondary/40"
      >
        <div className="flex flex-wrap items-center gap-2">
          <AssetsTypeBadge assetType={asset.assetType} />
          {asset.isPinned && (
            <span className="inline-flex items-center rounded-chip bg-base-secondary px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
              Pinned
            </span>
          )}
          {asset.moderationFlagged && (
            <StatusPill label="Flagged" tone="bad" />
          )}
        </div>

        <h3 className="mt-2 text-sm font-semibold leading-snug text-ink">
          {asset.title}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-faint">
          {asset.wordCount != null && <span>{asset.wordCount} words</span>}
          <span>{formatCreatedAt(asset.createdAt)}</span>
          <span aria-hidden className="ml-auto text-ink-faint">
            {expanded ? "Hide ▴" : "Preview ▾"}
          </span>
        </div>
      </button>

      {/* Inline preview — never a modal. */}
      {expanded && (
        <div id={previewId}>
          <AssetsPreview content={asset.content} />
        </div>
      )}
    </div>
  );
}

export function AssetsGrid({ assets }: { assets: AssetListItem[] }) {
  const [activeType, setActiveType] = useState<string>(ALL);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build the filter-chip set from the real types present, with live counts.
  const typeChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of assets) {
      counts.set(a.assetType, (counts.get(a.assetType) ?? 0) + 1);
    }
    const chips = Array.from(counts.entries())
      .map(([type, count]) => ({ value: type, label: assetTypeLabel(type), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: ALL, label: "All", count: assets.length }, ...chips];
  }, [assets]);

  const visible = useMemo(
    () =>
      activeType === ALL
        ? assets
        : assets.filter((a) => a.assetType === activeType),
    [assets, activeType],
  );

  return (
    <div className="space-y-4">
      {/* Filter-chip row — only shown when there is more than one type to filter. */}
      {typeChips.length > 2 && (
        <div className="flex flex-wrap gap-2">
          {typeChips.map((chip) => {
            const active = chip.value === activeType;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setActiveType(chip.value)}
                aria-pressed={active}
                className={[
                  "inline-flex items-center gap-1.5 rounded-chip px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-cobalt text-white"
                    : "bg-base-secondary text-ink-secondary hover:text-ink",
                ].join(" ")}
              >
                {chip.label}
                <span
                  className={[
                    "font-mono",
                    active ? "text-white/80" : "text-ink-faint",
                  ].join(" ")}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((asset) => (
          <AssetsCard
            key={asset.id}
            asset={asset}
            expanded={expandedId === asset.id}
            onToggle={() =>
              setExpandedId((id) => (id === asset.id ? null : asset.id))
            }
          />
        ))}
      </div>
    </div>
  );
}
