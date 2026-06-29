// PerformanceMemoryCards — learned, persistent insights about the brand's market
// (Screen 17, "MemoryInsightCard"). Each card shows the insight title +
// description, a neutral memory-type chip, a confidence indicator (3 bars +
// HIGH/MED/LOW, matching the confidence tiers in ui-constraints §8.3), how many
// scan weeks it's been observed (mono), and any supporting evidence (label/value,
// mono). Cobalt is never decorative here — confidence colour is meaning-bearing
// (green/amber/red), the rest is neutral. Presentational; data from SSR props.

import type {
  PerformanceMemory,
  SupportingEvidence,
} from "@/lib/data/performance";

// Confidence tiers (ui-constraints §8.3): HIGH ≥ 0.80, MED 0.50–0.79, LOW < 0.50.
type ConfTier = { label: string; filled: number; colour: string };

function confidenceTier(score: number | null): ConfTier | null {
  if (score == null) return null;
  if (score >= 0.8) return { label: "HIGH", filled: 3, colour: "bg-opportunity" };
  if (score >= 0.5) return { label: "MED", filled: 2, colour: "bg-watch" };
  return { label: "LOW", filled: 1, colour: "bg-urgent" };
}

function ConfidenceBars({ score }: { score: number | null }) {
  const tier = confidenceTier(score);
  if (!tier) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-3 w-1 rounded-sm ${
              i < tier.filled ? tier.colour : "bg-base-secondary"
            }`}
          />
        ))}
      </span>
      <span className="font-mono text-[11px] font-medium text-ink-secondary">
        {tier.label}
        {score != null && (
          <span className="ml-1 text-ink-faint">{score.toFixed(2)}</span>
        )}
      </span>
    </span>
  );
}

function MemoryTypeChip({ type }: { type: string }) {
  // Humanise snake_case memory types for display; styling stays neutral grey.
  const label = type.replace(/_/g, " ");
  return (
    <span className="inline-flex items-center rounded-chip bg-base-secondary px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-secondary">
      {label}
    </span>
  );
}

function EvidenceList({ items }: { items: SupportingEvidence[] }) {
  if (items.length === 0) return null;
  return (
    <dl className="mt-3 space-y-1.5 rounded-chip bg-base-secondary/60 px-3 py-2.5">
      {items.map((e, i) => (
        <div key={`${e.label}-${i}`} className="flex justify-between gap-3 text-xs">
          <dt className="text-ink-secondary">{e.label}</dt>
          <dd className="font-mono text-ink">{e.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MemoryCard({ memory }: { memory: PerformanceMemory }) {
  return (
    <article className="flex flex-col rounded-card bg-card p-5 shadow-sh1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MemoryTypeChip type={memory.memoryType} />
        <ConfidenceBars score={memory.confidenceScore} />
      </div>

      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-ink">
        {memory.title}
      </h3>
      <p className="mt-1.5 text-sm leading-6 text-ink-secondary">
        {memory.description}
      </p>

      <EvidenceList items={memory.supportingEvidence} />

      {memory.scanWeeksObserved != null && (
        <p className="mt-3 font-mono text-[11px] text-ink-faint">
          Observed across {memory.scanWeeksObserved}{" "}
          {memory.scanWeeksObserved === 1 ? "scan week" : "scan weeks"}
        </p>
      )}
    </article>
  );
}

export function PerformanceMemoryCards({
  memories,
}: {
  memories: PerformanceMemory[];
}) {
  if (memories.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {memories.map((m) => (
        <MemoryCard key={m.id} memory={m} />
      ))}
    </div>
  );
}
