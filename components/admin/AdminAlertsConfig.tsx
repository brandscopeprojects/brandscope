"use client";

// AdminAlertsConfig — the editable trigger list for the brand-admin Alerts screen
// (Screen 22). Each row is one alert trigger from the single alert_configs row:
// label + description, an editable threshold input (where the trigger has one), an
// active toggle, and the (display-only) delivery channels. Edits are submitted via
// the alerts server actions through useTransition. Tokens only; no hardcoded hexes.
//
// Delivery channels offered are Email + In-app ONLY — WhatsApp/Slack/webhook are
// Phase-2 / hard-excluded (CLAUDE.md) so they are never presented here.

import { useState, useTransition } from "react";
import { StatusPill } from "@/components/intelligence/StatusPill";
import {
  DELIVERY_CHANNELS,
  THRESHOLD_MIN,
  THRESHOLD_MAX,
} from "@/app/(app)/admin/alerts/constants";
import {
  toggleAlertActive,
  updateAlertConfig,
  setEmailDelivery,
  seedDefaultAlertConfigs,
  type AlertActionResult,
} from "@/app/(app)/admin/alerts/actions";
import type { AlertConfigView, AlertTriggerView } from "@/lib/data/admin-alerts";

export function AdminAlertsConfig({ config }: { config: AlertConfigView }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<AlertActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error);
    });
  }

  // No config row yet → the "Set up alerts" prompt that seeds the defaults.
  if (!config.configId) {
    return (
      <section className="rounded-card border border-dashed border-divider bg-card/50 px-6 py-12 text-center">
        <h3 className="font-display text-lg font-bold text-ink">Set up alerts</h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-ink-secondary">
          Get notified the moment a competitor makes a significant move between
          your weekly scans. We&rsquo;ll enable the standard set of triggers with
          sensible thresholds — you can fine-tune them after.
        </p>
        {error && (
          <p className="mx-auto mt-4 max-w-md rounded-chip bg-urgent/10 px-3 py-2 text-xs text-urgent">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => run(() => seedDefaultAlertConfigs())}
          disabled={pending}
          className="mt-5 rounded-chip bg-cobalt px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cobalt/90 disabled:opacity-50"
        >
          {pending ? "Setting up…" : "Set up alerts"}
        </button>
      </section>
    );
  }

  const configId = config.configId;
  const competitive = config.triggers.filter((t) => t.trigger.group === "competitive");
  const operational = config.triggers.filter((t) => t.trigger.group === "operational");

  return (
    <section className="space-y-4">
      {error && (
        <p className="rounded-chip bg-urgent/10 px-3 py-2 text-xs text-urgent">
          {error}
        </p>
      )}

      <DeliveryChannelBar
        configId={configId}
        emailEnabled={config.emailEnabled}
        emailAddress={config.emailAddress}
        pending={pending}
        run={run}
      />

      <TriggerGroup
        heading="Competitive triggers"
        triggers={competitive}
        configId={configId}
        pending={pending}
        run={run}
      />
      <TriggerGroup
        heading="Operational triggers"
        triggers={operational}
        configId={configId}
        pending={pending}
        run={run}
      />
    </section>
  );
}

function DeliveryChannelBar({
  configId,
  emailEnabled,
  emailAddress,
  pending,
  run,
}: {
  configId: string;
  emailEnabled: boolean;
  emailAddress: string | null;
  pending: boolean;
  run: (action: () => Promise<AlertActionResult>) => void;
}) {
  return (
    <div className="rounded-card bg-card p-4 shadow-sh1">
      <p className="text-xs font-medium text-ink-secondary">Delivery</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
        {DELIVERY_CHANNELS.map((ch) => {
          if (ch.key === "in_app") {
            return (
              <div key={ch.key} className="flex items-center gap-2">
                <StatusPill label="On" tone="good" />
                <span className="text-sm text-ink">{ch.label}</span>
                <span className="text-xs text-ink-faint">always on</span>
              </div>
            );
          }
          // Email — toggleable, with the destination address (mono) when set.
          return (
            <div key={ch.key} className="flex items-center gap-2">
              <Toggle
                on={emailEnabled}
                disabled={pending}
                ariaLabel="Email delivery"
                onToggle={(next) =>
                  run(() => setEmailDelivery(configId, next))
                }
              />
              <span className="text-sm text-ink">{ch.label}</span>
              {emailEnabled && emailAddress && (
                <span className="font-mono text-xs text-ink-faint">
                  {emailAddress}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TriggerGroup({
  heading,
  triggers,
  configId,
  pending,
  run,
}: {
  heading: string;
  triggers: AlertTriggerView[];
  configId: string;
  pending: boolean;
  run: (action: () => Promise<AlertActionResult>) => void;
}) {
  return (
    <div className="rounded-card bg-card shadow-sh1">
      <div className="border-b border-divider px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">{heading}</h2>
      </div>
      <ul>
        {triggers.map((t) => (
          <TriggerRow
            key={t.trigger.enabledColumn}
            view={t}
            configId={configId}
            pending={pending}
            run={run}
          />
        ))}
      </ul>
    </div>
  );
}

function TriggerRow({
  view,
  configId,
  pending,
  run,
}: {
  view: AlertTriggerView;
  configId: string;
  pending: boolean;
  run: (action: () => Promise<AlertActionResult>) => void;
}) {
  const { trigger, enabled, threshold } = view;

  return (
    <li className="flex flex-col gap-3 border-t border-divider px-4 py-4 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{trigger.label}</p>
        <p className="mt-0.5 text-xs leading-5 text-ink-secondary">
          {trigger.description}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        {trigger.thresholdColumn && (
          <ThresholdInput
            configId={configId}
            column={trigger.thresholdColumn}
            label={trigger.thresholdLabel ?? "Threshold"}
            unit={trigger.thresholdUnit}
            value={threshold}
            disabled={pending || !enabled}
            run={run}
          />
        )}

        <div className="flex items-center gap-2">
          <Toggle
            on={enabled}
            disabled={pending}
            ariaLabel={`${trigger.label} active`}
            onToggle={(next) =>
              run(() =>
                toggleAlertActive(configId, trigger.enabledColumn, next),
              )
            }
          />
          <StatusPill
            label={enabled ? "Active" : "Off"}
            tone={enabled ? "good" : "neutral"}
          />
        </div>
      </div>
    </li>
  );
}

function ThresholdInput({
  configId,
  column,
  label,
  unit,
  value,
  disabled,
  run,
}: {
  configId: string;
  column: import("@/app/(app)/admin/alerts/constants").AlertThresholdColumn;
  label: string;
  unit?: string;
  value: number | null;
  disabled: boolean;
  run: (action: () => Promise<AlertActionResult>) => void;
}) {
  const [draft, setDraft] = useState<string>(value != null ? String(value) : "");

  function commit() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(value != null ? String(value) : "");
      return;
    }
    if (parsed === value) return;
    run(() =>
      updateAlertConfig(configId, { thresholdColumn: column, threshold: parsed }),
    );
  }

  return (
    <label className="flex items-center gap-2 text-xs text-ink-secondary">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          min={THRESHOLD_MIN}
          max={THRESHOLD_MAX}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-16 rounded-chip border border-divider bg-card px-2 py-1 text-right font-mono text-[13px] text-ink focus:border-cobalt focus:outline-none disabled:opacity-50"
          aria-label={label}
        />
        {unit && <span className="font-mono text-[11px] text-ink-faint">{unit}</span>}
      </span>
    </label>
  );
}

// Accessible on/off switch. Cobalt when on (ui-constraints §12 toggle switches).
function Toggle({
  on,
  disabled,
  ariaLabel,
  onToggle,
}: {
  on: boolean;
  disabled: boolean;
  ariaLabel: string;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onToggle(!on)}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        on ? "bg-cobalt" : "bg-base-secondary",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-4 w-4 transform rounded-full bg-card shadow-sh1 transition-transform",
          on ? "translate-x-4" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}
