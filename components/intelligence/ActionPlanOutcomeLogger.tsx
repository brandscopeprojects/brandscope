"use client";

// ActionPlanOutcomeLogger — small inline form to log a real-world OUTCOME for a
// recommendation (Screen 15). Lives beneath an actioned ActionCard. If an outcome
// already exists it renders read-only; otherwise it offers a compact form that
// calls the logOutcome server action. Tokens only (ui-constraints §7).

import { useState, useTransition } from "react";
import { logOutcome, type LogOutcomeInput } from "@/app/(app)/action-plan/actions";
import type { OutcomeRecord } from "@/lib/data/action-plan";

type ResultKind = "positive" | "neutral" | "negative";

const RESULT_OPTIONS: { value: ResultKind; label: string }[] = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
];

// Result chip styling. Positive uses the only green token; neutral/negative stay
// neutral/urgent — never green for a non-positive result.
const RESULT_STYLE: Record<ResultKind, string> = {
  positive: "bg-opportunity/10 text-opportunity",
  neutral: "bg-base-secondary text-ink-secondary",
  negative: "bg-urgent/10 text-urgent",
};

function ExistingOutcome({ outcome }: { outcome: OutcomeRecord }) {
  const metric =
    outcome.outcomeMetric || outcome.outcomeValue != null
      ? [
          outcome.outcomeMetric,
          outcome.outcomeValue != null
            ? `${outcome.outcomeValue}${outcome.outcomeUnit ? ` ${outcome.outcomeUnit}` : ""}`
            : null,
        ]
          .filter(Boolean)
          .join(": ")
      : null;

  return (
    <div className="space-y-2 rounded-chip bg-base-secondary px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          Outcome logged
        </span>
        {outcome.result && (
          <span
            className={[
              "rounded-chip px-2 py-0.5 text-[11px] font-medium",
              RESULT_STYLE[outcome.result],
            ].join(" ")}
          >
            {outcome.result.charAt(0).toUpperCase() + outcome.result.slice(1)}
          </span>
        )}
      </div>
      <p className="text-sm leading-6 text-ink">{outcome.actionTaken}</p>
      {metric && <p className="font-mono text-xs text-ink-secondary">{metric}</p>}
      {outcome.notes && (
        <p className="text-sm leading-6 text-ink-secondary">{outcome.notes}</p>
      )}
    </div>
  );
}

export function ActionPlanOutcomeLogger({
  recommendationId,
  existing,
  onLogged,
}: {
  recommendationId: string;
  existing?: OutcomeRecord;
  onLogged: (outcome: OutcomeRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const [actionTaken, setActionTaken] = useState("");
  const [outcomeMetric, setOutcomeMetric] = useState("");
  const [outcomeValue, setOutcomeValue] = useState("");
  const [outcomeUnit, setOutcomeUnit] = useState("");
  const [result, setResult] = useState<ResultKind | "">("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (existing) return <ExistingOutcome outcome={existing} />;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-cobalt transition-colors hover:underline"
      >
        Log outcome
      </button>
    );
  }

  function submit() {
    setError(null);
    const trimmed = actionTaken.trim();
    if (!trimmed) {
      setError("Describe the action you took.");
      return;
    }

    const numericValue = outcomeValue.trim() ? Number(outcomeValue) : undefined;
    if (numericValue != null && Number.isNaN(numericValue)) {
      setError("Outcome value must be a number.");
      return;
    }

    const input: LogOutcomeInput = {
      actionTaken: trimmed,
      outcomeMetric: outcomeMetric.trim() || undefined,
      outcomeValue: numericValue,
      outcomeUnit: outcomeUnit.trim() || undefined,
      result: result || undefined,
      notes: notes.trim() || undefined,
    };

    startTransition(async () => {
      const res = await logOutcome(recommendationId, input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Reflect the logged outcome locally (mirrors what we just persisted).
      onLogged({
        id: `local-${recommendationId}`,
        recommendationId,
        actionTaken: trimmed,
        outcomeMetric: input.outcomeMetric ?? null,
        outcomeValue: input.outcomeValue ?? null,
        outcomeUnit: input.outcomeUnit ?? null,
        result: input.result ?? null,
        notes: input.notes ?? null,
        loggedAt: new Date().toISOString(),
      });
    });
  }

  const inputClass =
    "w-full rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-cobalt focus:outline-none";

  return (
    <div className="space-y-3 rounded-chip bg-base-secondary px-4 py-3">
      <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        Log outcome
      </p>

      <div className="space-y-1">
        <label className="text-xs font-medium text-ink-secondary" htmlFor={`action-${recommendationId}`}>
          What did you do?
        </label>
        <textarea
          id={`action-${recommendationId}`}
          value={actionTaken}
          onChange={(e) => setActionTaken(e.target.value)}
          rows={2}
          placeholder="e.g. Launched a matched welcome bonus and updated the landing hero."
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          value={outcomeMetric}
          onChange={(e) => setOutcomeMetric(e.target.value)}
          placeholder="Metric"
          aria-label="Outcome metric"
          className={inputClass}
        />
        <input
          value={outcomeValue}
          onChange={(e) => setOutcomeValue(e.target.value)}
          inputMode="decimal"
          placeholder="Value"
          aria-label="Outcome value"
          className={inputClass}
        />
        <input
          value={outcomeUnit}
          onChange={(e) => setOutcomeUnit(e.target.value)}
          placeholder="Unit"
          aria-label="Outcome unit"
          className={inputClass}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-ink-secondary">Result</span>
        {RESULT_OPTIONS.map((opt) => {
          const active = result === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => setResult(active ? "" : opt.value)}
              className={[
                "rounded-chip px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? opt.value === "positive"
                    ? "bg-opportunity text-white"
                    : opt.value === "negative"
                      ? "bg-urgent text-white"
                      : "bg-ink-secondary text-white"
                  : "bg-card text-ink-secondary hover:text-ink",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-1">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Notes (optional)"
          aria-label="Notes"
          className={inputClass}
        />
      </div>

      {error && (
        <p className="rounded-chip bg-urgent/10 px-3 py-2 text-xs text-urgent">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={pending}
          className="rounded-chip px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:text-ink disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-chip bg-cobalt px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-cobalt/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save outcome"}
        </button>
      </div>
    </div>
  );
}
