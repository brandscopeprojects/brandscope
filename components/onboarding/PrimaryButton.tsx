// PrimaryButton — cobalt primary CTA for the onboarding wizard (Screen 1).
// Cobalt = primary action per ui-constraints §2.2. A `variant="ghost"` is provided
// for the secondary "Back" control (neutral, no cobalt — cobalt is never decorative).

import type { ButtonHTMLAttributes } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function PrimaryButton({
  variant = "primary",
  className = "",
  children,
  ...rest
}: PrimaryButtonProps) {
  const base =
    "rounded-chip px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-cobalt text-white shadow-sh1 hover:bg-cobalt/90"
      : "bg-transparent text-ink-secondary hover:text-ink";
  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}
