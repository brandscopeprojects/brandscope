"use client";

// §13-A Identity — name, description, welcome message, and the editable list of
// suggested starter questions shown in an empty chat.

import { X, Plus } from "lucide-react";
import { Section, Field, inputClass } from "./fields";
import type { HqIdentityConfig } from "./types";

export function IdentitySection({
  value,
  onChange,
}: {
  value: HqIdentityConfig;
  onChange: (patch: Partial<HqIdentityConfig>) => void;
}) {
  const questions = value.suggestedQuestions ?? [];

  function setQuestion(i: number, text: string) {
    const next = [...questions];
    next[i] = text;
    onChange({ suggestedQuestions: next });
  }
  function removeQuestion(i: number) {
    onChange({ suggestedQuestions: questions.filter((_, idx) => idx !== i) });
  }
  function addQuestion() {
    onChange({ suggestedQuestions: [...questions, ""] });
  }

  return (
    <Section
      title="Identity"
      description="How the assistant introduces itself and what it invites operators to ask."
    >
      <Field label="Name" htmlFor="hq-name">
        <input
          id="hq-name"
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={inputClass}
        />
      </Field>

      <Field
        label="Description"
        htmlFor="hq-description"
        hint="A short line describing the assistant's remit."
      >
        <textarea
          id="hq-description"
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <Field
        label="Welcome message"
        htmlFor="hq-welcome"
        hint="Shown at the top of a fresh conversation."
      >
        <textarea
          id="hq-welcome"
          value={value.welcomeMessage}
          onChange={(e) => onChange({ welcomeMessage: e.target.value })}
          rows={2}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="space-y-2">
        <span className="text-sm font-medium text-ink-secondary">
          Suggested questions
        </span>
        <p className="text-xs text-ink-faint">
          Starter prompts offered in an empty chat.
        </p>
        <ul className="space-y-2">
          {questions.map((q, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQuestion(i, e.target.value)}
                aria-label={`Suggested question ${i + 1}`}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeQuestion(i)}
                aria-label={`Remove question ${i + 1}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip border border-divider text-ink-faint transition-colors hover:border-urgent hover:text-urgent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addQuestion}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-chip border border-divider px-3 py-2 text-sm font-medium text-ink-secondary transition-colors hover:border-cobalt hover:text-cobalt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add question
        </button>
      </div>
    </Section>
  );
}
