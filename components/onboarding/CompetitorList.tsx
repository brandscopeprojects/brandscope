"use client";

// CompetitorList — competitor entry rows (Screen 1, Step 4).
// Each competitor is a removable row: domain (AutoDetectInput → name+tier), an
// editable name, and an editable tier select. Add up to COMPETITOR_MAX (10);
// the wizard seeds COMPETITOR_DEFAULT_COUNT (5) empty rows. Tier stays editable
// after auto-detection (mvp-module-sources "Competitor Tier Detection").

import { AutoDetectInput } from "./AutoDetectInput";
import { COMPETITOR_MAX, COMPETITOR_TIERS } from "@/lib/onboarding/constants";
import type { CompetitorTier } from "@/lib/data/competitor-tier";

export type CompetitorEntry = {
  id: string; // client-only row key
  domain: string;
  name: string;
  tier: CompetitorTier;
  detecting: boolean;
};

type CompetitorListProps = {
  competitors: CompetitorEntry[];
  onChange: (id: string, patch: Partial<CompetitorEntry>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onDetect: (id: string, domain: string) => Promise<void>;
};

export function CompetitorList({
  competitors,
  onChange,
  onRemove,
  onAdd,
  onDetect,
}: CompetitorListProps) {
  const atMax = competitors.length >= COMPETITOR_MAX;

  return (
    <div className="flex flex-col gap-3">
      {competitors.map((c, i) => (
        <div
          key={c.id}
          className="flex flex-col gap-2 rounded-card border border-divider bg-card p-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <AutoDetectInput
              label={i === 0 ? "Competitor domain" : undefined}
              placeholder="competitor.com"
              value={c.domain}
              detecting={c.detecting}
              onChange={(v) => onChange(c.id, { domain: v })}
              onDetect={(v) => onDetect(c.id, v)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:w-40">
            {i === 0 && (
              <span className="text-sm font-medium text-ink-secondary">Name</span>
            )}
            <input
              aria-label="Competitor name"
              value={c.name}
              onChange={(e) => onChange(c.id, { name: e.target.value })}
              placeholder="Brand name"
              className="rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:w-36">
            {i === 0 && (
              <span className="text-sm font-medium text-ink-secondary">Tier</span>
            )}
            <select
              aria-label="Competitor tier"
              value={c.tier}
              onChange={(e) =>
                onChange(c.id, { tier: e.target.value as CompetitorTier })
              }
              className="rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none focus:border-cobalt"
            >
              {COMPETITOR_TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            aria-label="Remove competitor"
            onClick={() => onRemove(c.id)}
            className="self-end rounded-chip px-2 py-2 text-sm text-ink-faint transition-colors hover:text-urgent"
          >
            Remove
          </button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onAdd}
          disabled={atMax}
          className="rounded-chip border border-divider px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:text-ink disabled:opacity-50"
        >
          + Add competitor
        </button>
        <span className="font-mono text-xs text-ink-faint">
          {competitors.length} / {COMPETITOR_MAX}
        </span>
      </div>
    </div>
  );
}
