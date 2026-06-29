"use client";

// StatusControls — Accept / Snooze / Dismiss controls on the action card footer
// (ui-constraints §7 footer actions). Accept = cobalt (primary action, §2.2);
// Snooze / Dismiss = neutral text controls (cobalt is never decorative).
// When already actioned, the current status is reflected so the card reads as resolved.

import type { RecommendationStatus } from "@/types/view-models";

const STATUS_LABEL: Partial<Record<RecommendationStatus, string>> = {
  accepted: "Accepted",
  snoozed: "Snoozed",
  dismissed: "Dismissed",
  completed: "Completed",
};

export function StatusControls({
  status,
  onAccept,
  onSnooze,
  onDismiss,
}: {
  status: RecommendationStatus;
  onAccept: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
}) {
  // Once resolved, show the resolved state rather than re-offering the controls.
  if (status !== "open") {
    return (
      <span className="text-xs font-medium text-ink-secondary">
        {STATUS_LABEL[status] ?? "Resolved"}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onAccept}
        className="rounded-chip bg-cobalt px-3 py-1.5 text-xs font-medium text-white shadow-sh1 transition-colors hover:bg-cobalt/90"
      >
        Accept
      </button>
      <button
        type="button"
        onClick={onSnooze}
        className="rounded-chip px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        Snooze
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded-chip px-3 py-1.5 text-xs font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        Dismiss
      </button>
    </div>
  );
}
