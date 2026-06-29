"use client";

// AdminCompetitorsManager — Screen 21 (/admin/competitors) content.
// Lists the brand's tracked competitors (name + TierBadge + domain + priority)
// with Remove + reorder controls, plus an "Add competitor" form (domain + name +
// tier). Cap state ("7 of 10") and an at-cap note come from the server. All writes
// go through the page's server actions; optimistic UI + pending/error via
// useTransition. Tokens only (cobalt = primary/links, font-mono for domains).

import { useState, useTransition } from "react";
import { TierBadge } from "@/components/intelligence/TierBadge";
import { AdminCompetitorsAddForm } from "@/components/admin/AdminCompetitorsAddForm";
import type { BrandCompetitor } from "@/lib/data/competitors";
import type { CompetitorTier } from "@/lib/data/competitor-tier";
import {
  addCompetitor,
  removeCompetitor,
  reorderCompetitor,
} from "@/app/(app)/admin/competitors/actions";

type Props = {
  competitors: BrandCompetitor[];
  count: number;
  max: number;
  atCap: boolean;
};

export function AdminCompetitorsManager({ competitors, count, max, atCap }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Track the row currently being removed for an optimistic-feeling fade.
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleAdd(
    input: { domain: string; name: string; tier: CompetitorTier },
    onDone: (ok: boolean) => void,
  ) {
    setError(null);
    startTransition(async () => {
      const res = await addCompetitor(input);
      if (!res.ok) {
        setError(res.error);
        onDone(false);
        return;
      }
      onDone(true);
    });
  }

  function handleRemove(competitorId: string) {
    setError(null);
    setRemovingId(competitorId);
    startTransition(async () => {
      const res = await removeCompetitor(competitorId);
      if (!res.ok) setError(res.error);
      setRemovingId(null);
    });
  }

  function handleReorder(competitorId: string, direction: "up" | "down") {
    setError(null);
    startTransition(async () => {
      const res = await reorderCompetitor(competitorId, direction);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-5">
      {/* Cap summary */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-secondary">
          Tracking{" "}
          <span className="font-mono font-medium text-ink">
            {count} of {max}
          </span>{" "}
          competitors
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-chip border border-urgent/30 bg-urgent/5 px-3 py-2 text-sm text-urgent"
        >
          {error}
        </div>
      )}

      {/* Competitor list */}
      {competitors.length === 0 ? (
        <div className="rounded-card border border-dashed border-divider bg-card/50 px-6 py-10 text-center">
          <h3 className="font-display text-base font-bold text-ink">
            No competitors yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-ink-secondary">
            Add the first competitor below to include them in your weekly scan.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {competitors.map((c, i) => {
            const isRemoving = removingId === c.id;
            return (
              <li
                key={c.id}
                className={[
                  "flex flex-col gap-3 rounded-card bg-card p-4 shadow-sh1 transition-opacity sm:flex-row sm:items-center sm:justify-between",
                  isRemoving ? "opacity-50" : "",
                ].join(" ")}
              >
                <div className="flex min-w-0 items-start gap-3">
                  {/* Reorder controls */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      aria-label={`Move ${c.name} up`}
                      onClick={() => handleReorder(c.id, "up")}
                      disabled={pending || i === 0}
                      className="px-1 text-ink-faint transition-colors hover:text-cobalt disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${c.name} down`}
                      onClick={() => handleReorder(c.id, "down")}
                      disabled={pending || i === competitors.length - 1}
                      className="px-1 text-ink-faint transition-colors hover:text-cobalt disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>

                  <span className="mt-0.5 w-5 shrink-0 font-mono text-xs text-ink-faint">
                    {c.priority}
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-ink">{c.name}</span>
                      <TierBadge tier={c.tier} />
                    </div>
                    <a
                      href={`https://${c.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate font-mono text-xs text-cobalt hover:underline"
                    >
                      {c.domain}
                    </a>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(c.id)}
                  disabled={pending}
                  className="shrink-0 self-start rounded-chip border border-divider px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:border-urgent hover:text-urgent disabled:opacity-50 sm:self-auto"
                >
                  {isRemoving ? "Removing…" : "Remove"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add form / at-cap note */}
      {atCap ? (
        <div className="rounded-card border border-watch/30 bg-watch/5 p-4">
          <p className="text-sm font-medium text-ink">
            You&apos;ve reached the {max}-competitor limit.
          </p>
          <p className="mt-1 text-sm leading-6 text-ink-secondary">
            Remove a competitor above to track a different one. Need to watch more?
            Contact us about expanding your plan.
          </p>
        </div>
      ) : (
        <AdminCompetitorsAddForm onAdd={handleAdd} pending={pending} />
      )}
    </div>
  );
}
