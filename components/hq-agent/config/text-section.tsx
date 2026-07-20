"use client";

// §13-C Text chat — enabled, model DISPLAY (read-only), response length, streaming,
// and the recent-message window (Advanced).

import { Section, Field, Toggle, NumberField, ReadOnlyField, Advanced, inputClass } from "./fields";
import type { HqTextConfig, ResponseStyle } from "./types";

const STYLES: { value: ResponseStyle; label: string }[] = [
  { value: "concise", label: "Concise" },
  { value: "balanced", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
];

export function TextSection({
  value,
  onChange,
  model,
}: {
  value: HqTextConfig;
  onChange: (patch: Partial<HqTextConfig>) => void;
  model: string;
}) {
  return (
    <Section
      title="Text chat"
      description="The typed chat experience on the OpenAI Responses API."
    >
      <Toggle
        label="Text chat enabled"
        description="Turn the typed assistant on or off."
        checked={value.enabled}
        onChange={(v) => onChange({ enabled: v })}
      />

      <ReadOnlyField
        label="Model"
        value={model}
        hint="Server-controlled. Managed in Agent Control."
      />

      <Field
        label="Response length"
        htmlFor="hq-response-style"
        hint="How much detail the assistant aims for."
      >
        <select
          id="hq-response-style"
          value={value.responseStyle}
          onChange={(e) => onChange({ responseStyle: e.target.value as ResponseStyle })}
          className={inputClass}
        >
          {STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>

      <Toggle
        label="Streaming"
        description="Stream the reply token-by-token as it is generated."
        checked={value.streaming}
        onChange={(v) => onChange({ streaming: v })}
      />

      <Advanced>
        <NumberField
          label="Recent message limit"
          value={value.recentMessageLimit}
          onChange={(v) => onChange({ recentMessageLimit: v })}
          min={2}
          max={50}
          hint="How many prior messages are sent as context."
        />
        <NumberField
          label="Max output tokens"
          value={value.maxOutputTokens}
          onChange={(v) => onChange({ maxOutputTokens: v })}
          min={256}
          max={8000}
          step={64}
          hint="Upper bound on a single text reply."
        />
      </Advanced>
    </Section>
  );
}
