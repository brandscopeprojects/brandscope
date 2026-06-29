// ConfidenceBars — three filled/unfilled bars + HIGH/MED/LOW label (ui-constraints §8.2).
// Colour-matched: HIGH = green (opportunity), MED = amber (watch), LOW = red (urgent).
// Deliberately bar-shaped (not a solid tag) so it reads as visually DISTINCT from the
// urgency tag — they answer different questions ("how sure" vs "how urgent").
// Tokens only.

import type { ConfidenceLevel } from "@/types/view-models";

// filled bar count + label + colour classes per level.
const LEVEL_CONFIG: Record<
  ConfidenceLevel,
  { filled: number; label: string; fill: string }
> = {
  high: { filled: 3, label: "HIGH", fill: "bg-opportunity" },
  medium: { filled: 2, label: "MED", fill: "bg-watch" },
  low: { filled: 1, label: "LOW", fill: "bg-urgent" },
};

const LABEL_TEXT: Record<ConfidenceLevel, string> = {
  high: "text-opportunity",
  medium: "text-watch",
  low: "text-urgent",
};

export function ConfidenceBars({
  level,
  score,
}: {
  level: ConfidenceLevel;
  score?: number;
}) {
  const { filled, label, fill } = LEVEL_CONFIG[level];
  // Optional 0..1 score shown in mono as an evidence-style value (ui-constraints §3).
  const scoreText =
    typeof score === "number" ? `${Math.round(score * 100)}%` : null;

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={scoreText ? `Confidence ${scoreText}` : undefined}
      aria-label={`Confidence ${label}${scoreText ? ` ${scoreText}` : ""}`}
    >
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={[
              "w-1 rounded-sm",
              // staggered heights so it reads as a signal-strength meter, not a tag
              i === 0 ? "h-2" : i === 1 ? "h-2.5" : "h-3",
              i < filled ? fill : "bg-divider",
            ].join(" ")}
          />
        ))}
      </span>
      <span className={`text-[11px] font-semibold tracking-wide ${LABEL_TEXT[level]}`}>
        {label}
      </span>
      {scoreText && (
        <span className="font-mono text-[11px] text-ink-faint">{scoreText}</span>
      )}
    </span>
  );
}
