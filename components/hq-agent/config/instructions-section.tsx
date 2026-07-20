"use client";

// §13-B Instructions — the EDITABLE prompt layer. Additional guidance plus a list
// of restricted topics. The platform/system prompt is server-controlled and is
// deliberately NOT exposed here.

import { Section, Field, inputClass } from "./fields";
import type { HqInstructionsConfig } from "./types";

export function InstructionsSection({
  value,
  onChange,
}: {
  value: HqInstructionsConfig;
  onChange: (patch: Partial<HqInstructionsConfig>) => void;
}) {
  return (
    <Section
      title="Instructions"
      description="Extra guidance layered on top of the platform prompt. The base system prompt is managed server-side and cannot be edited here."
    >
      <Field
        label="Additional instructions"
        htmlFor="hq-additional"
        hint="Tone, priorities, or house rules for how the assistant answers."
      >
        <textarea
          id="hq-additional"
          value={value.additionalInstructions}
          onChange={(e) => onChange({ additionalInstructions: e.target.value })}
          rows={5}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <Field
        label="Restricted topics"
        htmlFor="hq-restricted"
        hint="Subjects the assistant should decline. One per line works well."
      >
        <textarea
          id="hq-restricted"
          value={value.restrictedTopics}
          onChange={(e) => onChange({ restrictedTopics: e.target.value })}
          rows={4}
          className={`${inputClass} resize-y`}
        />
      </Field>
    </Section>
  );
}
