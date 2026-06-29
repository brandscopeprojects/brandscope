"use client";

// AdminSettingsPreferences — brand-admin Settings (Screen 20), module-preferences
// half. Toggle each intelligence module on/off, submitting to
// updateBrandPreferences. Cobalt = the "on" toggle (own-brand accent) + the
// primary CTA. Inline success+error, pending via useTransition. Mobile = stacked.

import { useState, useTransition } from "react";
import {
  updateBrandPreferences,
  type SettingsActionResult,
  type UpdateBrandPreferencesInput,
} from "@/app/(app)/admin/settings/actions";
import {
  PREFERENCE_MODULES,
  type PreferenceModuleKey,
} from "@/app/(app)/admin/settings/constants";

type AdminSettingsPreferencesProps = {
  initial: Record<PreferenceModuleKey, boolean>;
};

export function AdminSettingsPreferences({
  initial,
}: AdminSettingsPreferencesProps) {
  const [toggles, setToggles] =
    useState<Record<PreferenceModuleKey, boolean>>(initial);
  const [result, setResult] = useState<SettingsActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function setModule(key: PreferenceModuleKey, value: boolean) {
    setResult(null);
    setToggles((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = toggles as UpdateBrandPreferencesInput;
    startTransition(async () => {
      const res = await updateBrandPreferences(payload);
      setResult(res);
    });
  }

  return (
    <section className="rounded-card bg-card p-6 shadow-sh1">
      <header className="mb-5">
        <h2 className="font-display text-lg font-bold text-ink">
          Module preferences
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Choose which intelligence modules the weekly scan runs and surfaces.
          Disabled modules are skipped.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-5">
        <ul className="divide-y divide-divider rounded-card bg-base-secondary/40">
          {PREFERENCE_MODULES.map((mod) => {
            const on = toggles[mod.key];
            const switchId = `module-${mod.key}`;
            return (
              <li
                key={mod.key}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <label
                    htmlFor={switchId}
                    className="block cursor-pointer text-sm font-medium text-ink"
                  >
                    {mod.label}
                  </label>
                  <span className="font-mono text-xs text-ink-faint">
                    {mod.route}
                  </span>
                </div>
                <button
                  id={switchId}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${mod.label} ${on ? "enabled" : "disabled"}`}
                  onClick={() => setModule(mod.key, !on)}
                  className={[
                    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                    on ? "bg-cobalt" : "bg-divider",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block h-5 w-5 transform rounded-full bg-card shadow-sh1 transition-transform",
                      on ? "translate-x-5" : "translate-x-0.5",
                    ].join(" ")}
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-chip bg-cobalt px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save preferences"}
          </button>
          {result?.ok && (
            <p className="text-sm font-medium text-opportunity" role="status">
              Preferences saved.
            </p>
          )}
          {result && !result.ok && (
            <p className="text-sm font-medium text-urgent" role="alert">
              {result.error}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
