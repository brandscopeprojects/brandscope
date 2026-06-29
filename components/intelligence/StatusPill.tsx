// StatusPill — inline status pill (ui-constraints §12). Three tones:
//   good    → green  (Healthy / Passed / Active / Compliant)
//   warn    → amber  (Degraded / Partial / Warning)
//   bad     → red    (Critical / Failed / Violation)
//   neutral → grey   (Absent / N/A / Pending)
// Note: green is reserved for genuinely positive states only (§15). Presentational.

export type StatusTone = "good" | "warn" | "bad" | "neutral";

const TONE: Record<StatusTone, string> = {
  good: "bg-opportunity/10 text-opportunity",
  warn: "bg-watch/10 text-watch",
  bad: "bg-urgent/10 text-urgent",
  neutral: "bg-base-secondary text-ink-secondary",
};

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: StatusTone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-chip px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}
    >
      {label}
    </span>
  );
}
