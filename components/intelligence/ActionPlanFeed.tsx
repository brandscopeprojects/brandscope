"use client";

// ActionPlanFeed — the full-width action feed for the Action Plan page (Screen 15).
// Mirrors components/dashboard/ActionFeed.tsx: filter-chip row + filtered list of
// ActionCards with optimistic Accept/Snooze/Dismiss (revert on error) and an
// honest Generate-Asset no-op. Adds: a "Completed" filter chip and, beneath every
// ACTIONED card (status ≠ open), an inline outcome logger. Tokens only.

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
} from "@/app/(app)/dashboard/actions";
import { ActionPlanOutcomeLogger } from "@/components/intelligence/ActionPlanOutcomeLogger";
import type { OutcomeRecord } from "@/lib/data/action-plan";

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

export function ActionPlanFeed({
  recommendations,
  outcomesByRecId,
}: {
  recommendations: Recommendation[];
  outcomesByRecId: Record<string, OutcomeRecord>;
}) {
  const [recs, setRecs] = useState<Recommendation[]>(recommendations);
  const [outcomes, setOutcomes] =
    useState<Record<string, OutcomeRecord>>(outcomesByRecId);
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
      { label: "Completed", count: count("completed"), status: "completed" },
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

  function handleLogged(id: string, outcome: OutcomeRecord) {
    setOutcomes((prev) => ({ ...prev, [id]: outcome }));
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterChips filters={filters} active={active} onChange={setActive} />

      {error && (
        <p className="rounded-chip bg-urgent/10 px-3 py-2 text-xs text-urgent">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="rounded-card border border-dashed border-divider bg-card/50 px-4 py-8 text-center text-sm text-ink-secondary">
          No {active === "all" ? "" : active + " "}actions in this view.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((rec) => {
            const actioned = rec.status !== "open";
            return (
              <div key={rec.id} className="space-y-3">
                <ActionCard
                  recommendation={rec}
                  onAccept={() => applyStatus(rec.id, "accepted")}
                  onSnooze={() => applyStatus(rec.id, "snoozed")}
                  onDismiss={() => applyStatus(rec.id, "dismissed")}
                  onGenerateAsset={() => handleGenerate(rec.id)}
                />
                {actioned && (
                  <div className="px-1">
                    <ActionPlanOutcomeLogger
                      recommendationId={rec.id}
                      existing={outcomes[rec.id]}
                      onLogged={(o) => handleLogged(rec.id, o)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
