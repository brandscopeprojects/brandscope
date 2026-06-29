// StepIndicator — onboarding wizard progress (Screen 1).
// Shows the step labels with the current/complete state. Cobalt marks progress.
// Light-theme component (used inside /onboarding).

type StepIndicatorProps = {
  steps: readonly string[];
  current: number; // 0-based index of the active step
};

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <ol className="flex w-full items-center gap-2" aria-label="Onboarding progress">
      {steps.map((label, i) => {
        const isComplete = i < current;
        const isActive = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={[
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                isActive
                  ? "bg-cobalt text-white"
                  : isComplete
                    ? "bg-cobalt/15 text-cobalt"
                    : "bg-base-secondary text-ink-faint",
              ].join(" ")}
              aria-current={isActive ? "step" : undefined}
            >
              {isComplete ? "✓" : i + 1}
            </span>
            <span
              className={[
                "hidden text-xs sm:inline",
                isActive ? "text-ink" : "text-ink-secondary",
              ].join(" ")}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span
                className={[
                  "h-px flex-1",
                  i < current ? "bg-cobalt/40" : "bg-divider",
                ].join(" ")}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
