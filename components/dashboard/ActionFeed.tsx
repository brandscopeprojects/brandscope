"use client";

// ActionFeed — the right rail of the split-field dashboard (ui-constraints §5 split
// layout, §11.1 filter chips). Owns: the filter-chip row, the filtered list of
// ActionCards, and the Accept/Snooze/Dismiss + Generate handlers that call the
// dashboard server actions. Status changes update optimistically and revert on error.

import { useMemo, useState, useTransition } from "react";
import type {
  Recommendation,
  RecommendationStatus,
  FilterChip,
  FilterStatus,
  Urgency,
} from "@/types/view-models";
import { FilterChips } from "@/components/ui/FilterChips";
import { ActionCard } from "@/components/action/ActionCard";
import {
  updateRecommendationStatus,
  generateAsset,
} from "@/app/dashboard/actions";

// Map a filter chip to the urgency it selects ("all" matches everything).
const FILTER_URGENCY: Partial<Record<FilterStatus, Urgency>> = {
  urgent: "urgent",
  watch: "watch",
  opportunity: "opportunity",
};

function matchesFilter(rec: Recommendation, filter: FilterStatus): boolean {
  if (filter === "all") return true;
  if (filter === "completed") return rec.status !== "open";
  return rec.urgency === FILTER_URGENCY[filter];
}

export function ActionFeed({
  recommendations,
}: {
  recommendations: Recommendation[];
}) {
  const [recs, setRecs] = useState<Recommendation[]>(recommendations);
  const [active, setActive] = useState<FilterStatus>("all");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filters: FilterChip[] = useMemo(() => {
    const count = (f: FilterStatus) =>
      recs.filter((r) => matchesFilter(r, f)).length;
    return [
      { label: "All", count: count("all"), status: "all" },
      { label: "Urgent", count: count("urgent"), status: "urgent" },
      { label: "Watch", count: count("watch"), status: "watch" },
      { label: "Opportunity", count: count("opportunity"), status: "opportunity" },
    ];
  }, [recs]);

  const visible = useMemo(
    () => recs.filter((r) => matchesFilter(r, active)),
    [recs, active],
  );

  function applyStatus(id: string, status: RecommendationStatus) {
    setError(null);
    const previous = recs;
    // Optimistic: reflect the resolved state immediately.
    setRecs((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    startTransition(async () => {
      const result = await updateRecommendationStatus(id, status);
      if (!result.ok) {
        setRecs(previous); // revert
        setError(result.error);
      }
    });
  }

  async function handleGenerate(id: string) {
    setError(null);
    const result = await generateAsset(id);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-ink">Action plan</h2>
        <span className="font-mono text-xs text-ink-faint">
          {recs.length} {recs.length === 1 ? "recommendation" : "recommendations"}
        </span>
      </div>

      <FilterChips filters={filters} active={active} onChange={setActive} />

      {error && (
        <p className="rounded-chip bg-urgent/10 px-3 py-2 text-xs text-urgent">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <p className="rounded-card border border-dashed border-divider bg-card/50 px-4 py-8 text-center text-sm text-ink-secondary">
            No {active === "all" ? "" : active + " "}actions in this view.
          </p>
        ) : (
          visible.map((rec) => (
            <ActionCard
              key={rec.id}
              recommendation={rec}
              onAccept={() => applyStatus(rec.id, "accepted")}
              onSnooze={() => applyStatus(rec.id, "snoozed")}
              onDismiss={() => applyStatus(rec.id, "dismissed")}
              onGenerateAsset={() => handleGenerate(rec.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
