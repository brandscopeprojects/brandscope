// TextInput — labelled text field for the onboarding wizard (Screen 1).
// Tokens: card surface, divider border, cobalt focus, ink/ink-secondary text.

import type { InputHTMLAttributes } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function TextInput({ label, hint, id, className = "", ...rest }: TextInputProps) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink-secondary">
        {label}
      </label>
      <input
        id={inputId}
        className={`rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt ${className}`}
        {...rest}
      />
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
