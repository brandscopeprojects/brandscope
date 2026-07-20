"use client";

// §13-G Usage controls — rate and budget limits.

import { Section, NumberField } from "./fields";
import type { HqUsageConfig } from "./types";

export function UsageSection({
  value,
  onChange,
}: {
  value: HqUsageConfig;
  onChange: (patch: Partial<HqUsageConfig>) => void;
}) {
  return (
    <Section
      title="Usage controls"
      description="Rate limits and a budget alert to keep spend predictable."
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <NumberField
          label="Text requests / minute"
          value={value.textRequestsPerMin}
          onChange={(v) => onChange({ textRequestsPerMin: v })}
          min={0}
          max={120}
          suffix="/min"
        />
        <NumberField
          label="Voice sessions / hour"
          value={value.realtimeSessionsPerHour}
          onChange={(v) => onChange({ realtimeSessionsPerHour: v })}
          min={0}
          max={60}
          suffix="/hr"
        />
        <NumberField
          label="Daily voice minutes"
          value={value.dailyVoiceMinuteLimit}
          onChange={(v) => onChange({ dailyVoiceMinuteLimit: v })}
          min={0}
          max={1440}
          suffix="min/day"
        />
        <NumberField
          label="Monthly budget warning"
          value={value.monthlyBudgetWarningUsd}
          onChange={(v) => onChange({ monthlyBudgetWarningUsd: v })}
          min={0}
          step={10}
          suffix="USD"
          hint="Alert threshold — not a hard cap."
        />
      </div>
    </Section>
  );
}
