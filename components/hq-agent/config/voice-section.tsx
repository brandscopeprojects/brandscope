"use client";

// §13-D Voice — enabled, model DISPLAY (read-only), voice selection, transcript
// visibility, turn detection, interruptions, save transcript, and the low-level
// session limits (Advanced).

import { Section, Field, Toggle, NumberField, ReadOnlyField, Advanced, inputClass } from "./fields";
import type { HqVoiceConfig } from "./types";

export function VoiceSection({
  value,
  onChange,
  model,
  voices,
}: {
  value: HqVoiceConfig;
  onChange: (patch: Partial<HqVoiceConfig>) => void;
  model: string;
  voices: string[];
}) {
  const voiceOptions = voices.includes(value.voice) ? voices : [value.voice, ...voices];

  return (
    <Section
      title="Voice"
      description="The spoken assistant on the OpenAI Realtime API over WebRTC."
    >
      <Toggle
        label="Voice enabled"
        description="Allow operators to talk to the assistant."
        checked={value.enabled}
        onChange={(v) => onChange({ enabled: v })}
      />

      <ReadOnlyField
        label="Realtime model"
        value={model}
        hint="Server-controlled. Managed in Agent Control."
      />

      <Field label="Voice" htmlFor="hq-voice" hint="The spoken voice used for replies.">
        <select
          id="hq-voice"
          value={value.voice}
          onChange={(e) => onChange({ voice: e.target.value })}
          className={inputClass}
        >
          {voiceOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Field>

      <div className="divide-y divide-divider">
        <Toggle
          label="Show transcript"
          description="Display the live text transcript during a call."
          checked={value.transcriptVisible}
          onChange={(v) => onChange({ transcriptVisible: v })}
        />
        <Toggle
          label="Automatic turn detection"
          description="Let the model detect when the speaker has finished (server VAD)."
          checked={value.turnDetection}
          onChange={(v) => onChange({ turnDetection: v })}
        />
        <Toggle
          label="Allow interruptions"
          description="Let the operator talk over the assistant to cut it off."
          checked={value.interruptions}
          onChange={(v) => onChange({ interruptions: v })}
        />
        <Toggle
          label="Save transcript"
          description="Persist the conversation transcript after the call."
          checked={value.saveTranscript}
          onChange={(v) => onChange({ saveTranscript: v })}
        />
      </div>

      <Advanced>
        <NumberField
          label="Max session minutes"
          value={value.maxSessionMinutes}
          onChange={(v) => onChange({ maxSessionMinutes: v })}
          min={1}
          max={120}
          suffix="min"
        />
        <NumberField
          label="Idle timeout"
          value={value.idleTimeoutSeconds}
          onChange={(v) => onChange({ idleTimeoutSeconds: v })}
          min={5}
          max={600}
          suffix="sec"
          hint="End the call after this much silence."
        />
        <NumberField
          label="Max spoken response"
          value={value.maxSpokenResponseSeconds}
          onChange={(v) => onChange({ maxSpokenResponseSeconds: v })}
          min={5}
          max={120}
          suffix="sec"
          hint="Cap the length of a single spoken reply."
        />
      </Advanced>
    </Section>
  );
}
