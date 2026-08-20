"use client";

// Engine Configuration panel — Competitive Intelligence back-office. Lets a
// platform admin create a new draft config (copied from an existing one,
// with edits), and activate a draft. Activation is a separate, reason-gated
// action — never automatic. Values shown here ARE the proprietary weights
// (internal-admin-only surface); the customer UI never sees this component.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  activateScoringConfig,
  createDraftConfig,
  updateDraftConfig,
} from "@/app/brandscope-admin/competitive-intelligence/actions";
import type { ScoringConfigRow } from "@/lib/data/internal-competitive-intelligence";

const inputClass =
  "w-full rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt";

const EDITABLE_FIELDS: { key: string; label: string; step?: string }[] = [
  { key: "weightCustomerActivity", label: "Market Standing — Customer Activity weight" },
  { key: "weightAcquisitionPower", label: "Market Standing — Acquisition Power weight" },
  { key: "weightCommercialPresence", label: "Market Standing — Commercial Presence weight" },
  { key: "weightCustomerMindshare", label: "Market Standing — Customer Mindshare weight" },
  { key: "thresholdDominantMarketStanding", label: "Tier — Dominant standing threshold" },
  { key: "thresholdMidmarketMarketStanding", label: "Tier — Mid-Market standing threshold" },
  { key: "thresholdChallengerMarketStanding", label: "Tier — Challenger standing threshold" },
  { key: "thresholdDominantOverlap", label: "Tier — Dominant overlap minimum" },
  { key: "thresholdMidmarketOverlap", label: "Tier — Mid-Market overlap minimum" },
  { key: "thresholdChallengerOverlap", label: "Tier — Challenger overlap minimum" },
  { key: "thresholdChallengerMomentumPressure", label: "Tier — Challenger momentum minimum" },
  { key: "overlapWeightProduct", label: "Overlap — Product weight" },
  { key: "overlapWeightKeyword", label: "Overlap — Keyword weight" },
  { key: "overlapWeightChannel", label: "Overlap — Channel weight" },
  { key: "threatWeightOverlap", label: "Threat — Overlap weight" },
  { key: "threatWeightRelativeStrength", label: "Threat — Relative Strength weight" },
  { key: "threatWeightMomentum", label: "Threat — Momentum weight" },
  { key: "relativeStrengthClampMin", label: "Relative Strength — clamp min (log2)", step: "0.1" },
  { key: "relativeStrengthClampMax", label: "Relative Strength — clamp max (log2)", step: "0.1" },
  { key: "relativeStrengthCenter", label: "Relative Strength — center" },
  { key: "relativeStrengthScale", label: "Relative Strength — scale" },
  { key: "momentumLookbackPeriods", label: "Momentum — lookback periods" },
  { key: "momentumStrongUpwardThreshold", label: "Momentum — strong upward threshold" },
  { key: "momentumUpwardThreshold", label: "Momentum — upward threshold" },
  { key: "momentumDownwardThreshold", label: "Momentum — downward threshold" },
  { key: "momentumStrongDownwardThreshold", label: "Momentum — strong downward threshold" },
  { key: "momentumStabilityStddevThreshold", label: "Momentum — stability stddev threshold" },
  { key: "momentumPressureStrongUpward", label: "Momentum — strong-upward pressure score" },
  { key: "momentumPressureUpward", label: "Momentum — upward pressure score" },
  { key: "standingConfidenceContradictionPenalty", label: "Confidence — contradiction penalty" },
  { key: "missingDimensionCoverageThreshold", label: "Missing-data coverage threshold (%)" },
];

export function ScoringConfigPanel({
  configs,
  actorProfileId,
}: {
  configs: ScoringConfigRow[];
  actorProfileId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [creatingFrom, setCreatingFrom] = useState<string | null>(null);
  const [newConfigName, setNewConfigName] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activateReason, setActivateReason] = useState("");

  const activeConfig = configs.find((c) => c.status === "active");
  const drafts = configs.filter((c) => c.status === "draft");
  const retired = configs.filter((c) => c.status === "retired");

  function numericEdits(): Partial<Record<string, number>> {
    const result: Partial<Record<string, number>> = {};
    for (const [k, v] of Object.entries(edits)) {
      if (v.trim() !== "" && !Number.isNaN(Number(v))) result[k] = Number(v);
    }
    return result;
  }

  function submitCreateDraft(sourceConfigId: string) {
    if (!newConfigName.trim()) {
      setError("Name the new draft version.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createDraftConfig({
        sourceConfigId,
        configName: newConfigName.trim(),
        edits: numericEdits(),
      });
      if (!result.ok) setError(result.error);
      else {
        setCreatingFrom(null);
        setNewConfigName("");
        setEdits({});
        router.refresh();
      }
    });
  }

  function submitUpdateDraft(configId: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateDraftConfig({ configId, edits: numericEdits() });
      if (!result.ok) setError(result.error);
      else {
        setEditingConfigId(null);
        setEdits({});
        router.refresh();
      }
    });
  }

  function submitActivate(configId: string) {
    if (!activateReason.trim()) {
      setError("A reason is required to activate a config version.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await activateScoringConfig({ configId, reason: activateReason.trim(), actorProfileId });
      if (!result.ok) setError(result.error);
      else {
        setActivatingId(null);
        setActivateReason("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-chip border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="rounded-card border border-divider bg-card p-4">
        <h3 className="font-display text-sm font-bold text-ink">Active version</h3>
        {activeConfig ? (
          <p className="mt-1 text-sm text-ink-secondary">
            v{activeConfig.version} — {activeConfig.configName} (activated{" "}
            {activeConfig.activatedAt ? new Date(activeConfig.activatedAt).toLocaleString() : "—"})
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink-faint">
            No active configuration. The Market Power Engine is blocked from calculating until a platform admin
            activates a draft.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="font-display text-sm font-bold text-ink">Draft versions</h3>
        {drafts.length === 0 && <p className="text-sm text-ink-faint">No drafts.</p>}
        {drafts.map((d) => (
          <div key={d.id} className="rounded-card border border-divider bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink">
                v{d.version} — {d.configName}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingConfigId(editingConfigId === d.id ? null : d.id);
                    setEdits({});
                  }}
                  className="rounded-chip border border-divider px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setActivatingId(activatingId === d.id ? null : d.id)}
                  className="rounded-chip bg-cobalt px-3 py-1.5 text-xs font-medium text-white hover:bg-cobalt-hover"
                >
                  Activate
                </button>
              </div>
            </div>

            {editingConfigId === d.id && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-divider pt-4 sm:grid-cols-2">
                {EDITABLE_FIELDS.map((f) => (
                  <label key={f.key} className="block space-y-1">
                    <span className="text-xs font-medium text-ink-secondary">{f.label}</span>
                    <input
                      type="number"
                      step={f.step ?? "1"}
                      className={inputClass}
                      placeholder="unchanged"
                      value={edits[f.key] ?? ""}
                      onChange={(e) => setEdits((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  </label>
                ))}
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submitUpdateDraft(d.id)}
                    className="rounded-chip bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Save draft edits
                  </button>
                </div>
              </div>
            )}

            {activatingId === d.id && (
              <div className="mt-4 space-y-2 border-t border-divider pt-4">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-ink-secondary">
                    Reason (required, recorded in the audit trail)
                  </span>
                  <input
                    className={inputClass}
                    value={activateReason}
                    onChange={(e) => setActivateReason(e.target.value)}
                    placeholder="e.g. Passed golden benchmark, 92% tier accuracy"
                  />
                </label>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submitActivate(d.id)}
                  className="rounded-chip bg-cobalt px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Confirm activation
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-card border border-divider bg-card p-4">
        <h3 className="font-display text-sm font-bold text-ink">
          Create new draft {activeConfig ? "(from active)" : "(from most recent)"}
        </h3>
        <p className="mt-1 text-xs text-ink-faint">
          Rollback works the same way: create a new draft from an earlier version, then activate it.
        </p>
        {(() => {
          const source = activeConfig ?? configs[0];
          if (!source) return <p className="mt-2 text-sm text-ink-faint">No configs to copy from.</p>;
          const isOpen = creatingFrom === source.id;
          return (
            <div className="mt-3">
              {!isOpen ? (
                <button
                  type="button"
                  onClick={() => setCreatingFrom(source.id)}
                  className="rounded-chip border border-divider px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-hover"
                >
                  New draft from v{source.version}
                </button>
              ) : (
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-medium text-ink-secondary">New version name</span>
                    <input
                      className={inputClass}
                      value={newConfigName}
                      onChange={(e) => setNewConfigName(e.target.value)}
                      placeholder="e.g. Post-benchmark calibration v2"
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {EDITABLE_FIELDS.map((f) => (
                      <label key={f.key} className="block space-y-1">
                        <span className="text-xs font-medium text-ink-secondary">{f.label}</span>
                        <input
                          type="number"
                          step={f.step ?? "1"}
                          className={inputClass}
                          placeholder="unchanged from source"
                          value={edits[f.key] ?? ""}
                          onChange={(e) => setEdits((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => submitCreateDraft(source.id)}
                    className="rounded-chip bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Create draft
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {retired.length > 0 && (
        <div className="space-y-1">
          <h3 className="font-display text-sm font-bold text-ink">Retired versions</h3>
          <ul className="text-sm text-ink-faint">
            {retired.map((r) => (
              <li key={r.id}>
                v{r.version} — {r.configName} (retired{" "}
                {r.retiredAt ? new Date(r.retiredAt).toLocaleDateString() : "—"})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
