"use client";

// Shared, token-only form primitives for the HQ Agent config sections. Copies the
// hand-rolled input styling used across the admin area (no shared Input/Card kit).
// Every control is keyboard-reachable, labelled, and >=44px on its primary axis.

import { useId } from "react";

export const inputClass =
  "w-full rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt";

/** Card-framed section with a display title + one-line description. */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card bg-card p-5 shadow-sh1 md:p-6">
      <header className="mb-5">
        <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-ink-secondary">{description}</p>
        )}
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Label + control + optional hint. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-secondary">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

/** Read-only display value (e.g. server-controlled model name). */
export function ReadOnlyField({
  label,
  value,
  hint,
  mono = true,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}) {
  return (
    <Field label={label} hint={hint}>
      <div
        className={[
          "w-full rounded-chip border border-divider bg-base-secondary px-3 py-2 text-sm text-ink-secondary",
          mono ? "font-mono" : "",
        ].join(" ")}
      >
        {value || "—"}
      </div>
    </Field>
  );
}

/** Accessible on/off switch as a labelled row. 44px tall target. */
export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-4 py-1">
      <span className="flex flex-col">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description && (
          <span className="text-xs text-ink-faint">{description}</span>
        )}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled || !onChange}
        onClick={() => onChange?.(!checked)}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          checked ? "bg-cobalt" : "bg-divider",
          disabled || !onChange ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white shadow-sh1 transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

/** Bounded number input. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  hint,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  suffix?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className={`${inputClass} font-mono`}
        />
        {suffix && (
          <span className="shrink-0 text-xs text-ink-faint">{suffix}</span>
        )}
      </div>
    </Field>
  );
}

/** Collapsible group for low-level/advanced fields. */
export function Advanced({ children }: { children: React.ReactNode }) {
  return (
    <details className="group rounded-chip border border-divider bg-base-secondary/40 p-3">
      <summary className="cursor-pointer select-none text-sm font-medium text-ink-secondary marker:content-none">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-ink-faint transition-transform group-open:rotate-90">
            ▸
          </span>
          Advanced
        </span>
      </summary>
      <div className="mt-4 space-y-5">{children}</div>
    </details>
  );
}
