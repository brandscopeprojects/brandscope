"use client";

// AutoDetectInput — a domain field that auto-detects on blur (Screen 1, steps 1 & 4).
// Used for the brand domain (Step 1: auto-fill brand name) and competitor domains
// (Step 4: "Detect Brand" → name + tier). The detection itself runs in a server
// action passed via `onDetect`; this component only manages the input + busy state.

import { useState, type InputHTMLAttributes } from "react";

type AutoDetectInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onBlur" | "value" | "onChange"
> & {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Runs on blur (and on the inline button). Resolves when detection completes. */
  onDetect: (value: string) => Promise<void>;
  detecting?: boolean;
  buttonLabel?: string;
};

export function AutoDetectInput({
  label,
  value,
  onChange,
  onDetect,
  detecting = false,
  buttonLabel = "Detect Brand",
  id,
  className = "",
  ...rest
}: AutoDetectInputProps) {
  const [localBusy, setLocalBusy] = useState(false);
  const busy = detecting || localBusy;
  const inputId = id ?? "autodetect-domain";

  async function runDetect() {
    if (!value.trim() || busy) return;
    setLocalBusy(true);
    try {
      await onDetect(value);
    } finally {
      setLocalBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-ink-secondary">
          {label}
        </label>
      )}
      <div className="flex items-stretch gap-2">
        <input
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={runDetect}
          className={`flex-1 rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt ${className}`}
          {...rest}
        />
        <button
          type="button"
          onClick={runDetect}
          disabled={busy || !value.trim()}
          className="shrink-0 rounded-chip border border-cobalt px-3 py-2 text-xs font-medium text-cobalt transition-colors hover:bg-cobalt/10 disabled:opacity-50"
        >
          {busy ? "Detecting…" : buttonLabel}
        </button>
      </div>
    </div>
  );
}
