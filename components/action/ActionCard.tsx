"use client";

// ActionCard — the action-feed workhorse (ui-constraints §7 card anatomy).
// Composes the EXACT card structure, top → bottom:
//   1. status row: [UrgencyTag][CategoryTag] ........ [ConfidenceBars]
//   2. headline (Inter 600, specific & time-bound)
//   3. "why now" trigger (muted secondary)
//   4. AssumptionCallout — ONLY on LOW/MED confidence + non-empty flags, above evidence
//   5. EvidenceDrawer (collapsed by default; expand state owned here)
//   6. footer: GenerateAssetButton (primary) + StatusControls (Accept/Snooze/Dismiss)
// Card surface white, shadow-sh1, rounded-card. Tokens only.

import { useState } from "react";
import type { Recommendation } from "@/types/view-models";
import { UrgencyTag, CategoryTag } from "@/components/ui/Tags";
import { ConfidenceBars } from "@/components/ui/ConfidenceBars";
import { AssumptionCallout } from "@/components/action/AssumptionCallout";
import { EvidenceDrawer } from "@/components/action/EvidenceDrawer";
import { GenerateAssetButton } from "@/components/action/GenerateAssetButton";
import { StatusControls } from "@/components/action/StatusControls";

export function ActionCard({
  recommendation,
  onAccept,
  onSnooze,
  onDismiss,
  onGenerateAsset,
  defaultExpanded = false,
}: {
  recommendation: Recommendation;
  onAccept: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
  onGenerateAsset: () => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const {
    id,
    urgency,
    category,
    headline,
    triggerReason,
    confidenceLevel,
    confidenceScore,
    evidence,
    assumptionFlags,
    status,
  } = recommendation;

  // Assumption callout only on LOW/MED confidence with flags present (§7 step 4).
  const showAssumptions =
    (confidenceLevel === "low" || confidenceLevel === "medium") &&
    assumptionFlags.length > 0;

  return (
    <article className="space-y-3 rounded-card bg-card p-5 shadow-sh1">
      {/* 1. Status row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyTag urgency={urgency} />
          <CategoryTag category={category} />
        </div>
        <ConfidenceBars level={confidenceLevel} score={confidenceScore} />
      </div>

      {/* 2. Headline */}
      <h3 className="text-[15px] font-semibold leading-snug text-ink">
        {headline}
      </h3>

      {/* 3. "Why now" trigger */}
      <p className="text-sm leading-6 text-ink-secondary">{triggerReason}</p>

      {/* 4. Assumption callout (LOW/MED + flags only) */}
      {showAssumptions && <AssumptionCallout flags={assumptionFlags} />}

      {/* 5. Evidence drawer (collapsed by default) */}
      <EvidenceDrawer
        evidence={evidence}
        expanded={expanded}
        onToggle={() => setExpanded((e) => !e)}
      />

      {/* 6. Footer actions */}
      <div className="space-y-3 border-t border-divider pt-3">
        <GenerateAssetButton recommendationId={id} onGenerate={onGenerateAsset} />
        <div className="flex justify-end">
          <StatusControls
            status={status}
            onAccept={onAccept}
            onSnooze={onSnooze}
            onDismiss={onDismiss}
          />
        </div>
      </div>
    </article>
  );
}
