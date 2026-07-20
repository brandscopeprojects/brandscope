"use client";

// §13-F Safety — read-only mode, write-action confirmation, and the fixed
// no-answer policy shown read-only.

import { ShieldCheck } from "lucide-react";
import { Section, Toggle } from "./fields";
import type { HqDataConfig, HqSafetyConfig } from "./types";

const NO_ANSWER_POLICY =
  "I could not confirm that from the available Brandscope data.";

export function SafetySection({
  data,
  safety,
  onDataChange,
  onSafetyChange,
}: {
  data: HqDataConfig;
  safety: HqSafetyConfig;
  onDataChange: (patch: Partial<HqDataConfig>) => void;
  onSafetyChange: (patch: Partial<HqSafetyConfig>) => void;
}) {
  return (
    <Section
      title="Safety"
      description="Guardrails on what the assistant may do and how it handles gaps."
    >
      <div className="divide-y divide-divider">
        <Toggle
          label="Read-only mode"
          description="Only allow read queries — no write/mutating actions."
          checked={data.readOnly}
          onChange={(v) => onDataChange({ readOnly: v })}
        />
        <Toggle
          label="Require confirmation for write actions"
          description="Prompt for explicit confirmation before any mutating action."
          checked={safety.requireConfirmationForWriteActions}
          onChange={(v) => onSafetyChange({ requireConfirmationForWriteActions: v })}
        />
      </div>

      <div className="rounded-chip border border-divider bg-base-secondary p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-info" aria-hidden />
          <span className="text-sm font-medium text-ink-secondary">
            When it cannot confirm an answer
          </span>
        </div>
        <p className="text-sm italic text-ink">&ldquo;{NO_ANSWER_POLICY}&rdquo;</p>
        <p className="mt-1.5 text-xs text-ink-faint">
          Fixed policy — the assistant discloses missing data rather than guessing.
        </p>
      </div>
    </Section>
  );
}
