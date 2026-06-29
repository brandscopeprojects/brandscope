"use client";

// CompetitorList — competitor entry rows (Screen 1, Step 4).
// Each competitor is a removable row: domain (AutoDetectInput → name+tier), an
// editable name, and an editable tier select. Add up to COMPETITOR_MAX (10);
// the wizard seeds COMPETITOR_DEFAULT_COUNT (5) empty rows.
//
// Layout: a CSS grid (not flex) with minmax(0,1fr) + min-w-0 cells so the inline
// "Detect" button can never overflow into the Name column. One aligned header row
// on desktop; stacked, labelled fields on mobile (ui-constraints §4 spacing,
// whitespace over borders).

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

// domain (flexible) · name · tier · remove. minmax(0,1fr) lets the domain cell
// shrink so its input+button stay contained.
const COLS = "sm:grid-cols-[minmax(0,1fr)_11rem_9rem_auto]";
const fieldClass =
  "w-full rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt";

export function CompetitorList({
  competitors,
  onChange,
  onRemove,
  onAdd,
  onDetect,
}: CompetitorListProps) {
  const atMax = competitors.length >= COMPETITOR_MAX;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Column headers — desktop only; mobile uses per-field labels. */}
      <div className={`hidden px-1 sm:grid ${COLS} sm:gap-3`}>
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Competitor domain
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Name
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Tier
        </span>
        <span aria-hidden />
      </div>

      {competitors.map((c) => (
        <div
          key={c.id}
          className={`grid grid-cols-1 gap-3 rounded-card bg-base-secondary/40 p-3 sm:items-center sm:gap-3 sm:bg-transparent sm:p-1 ${COLS}`}
        >
          {/* Domain + inline detect */}
          <div className="min-w-0">
            <span className="mb-1 block text-xs font-medium text-ink-secondary sm:hidden">
              Competitor domain
            </span>
            <AutoDetectInput
              placeholder="competitor.com"
              value={c.domain}
              detecting={c.detecting}
              onChange={(v) => onChange(c.id, { domain: v })}
              onDetect={(v) => onDetect(c.id, v)}
              buttonLabel="Detect"
            />
          </div>

          {/* Name */}
          <div className="min-w-0">
            <span className="mb-1 block text-xs font-medium text-ink-secondary sm:hidden">
              Name
            </span>
            <input
              aria-label="Competitor name"
              value={c.name}
              onChange={(e) => onChange(c.id, { name: e.target.value })}
              placeholder="Brand name"
              className={fieldClass}
            />
          </div>

          {/* Tier */}
          <div className="min-w-0">
            <span className="mb-1 block text-xs font-medium text-ink-secondary sm:hidden">
              Tier
            </span>
            <select
              aria-label="Competitor tier"
              value={c.tier}
              onChange={(e) => onChange(c.id, { tier: e.target.value as CompetitorTier })}
              className={fieldClass}
            >
              {COMPETITOR_TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Remove */}
          <button
            type="button"
            aria-label="Remove competitor"
            onClick={() => onRemove(c.id)}
            className="justify-self-start rounded-chip px-2 py-2 text-sm text-ink-faint transition-colors hover:text-urgent sm:justify-self-center"
          >
            Remove
          </button>
        </div>
      ))}

      <div className="mt-1 flex items-center justify-between">
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
