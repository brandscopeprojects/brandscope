"use client";

// Hq Agent — empty / zero-state. Warm and restrained: a short invitation and
// a wrapped row of suggestion chips. No oversized art, no gradients, no neon.

import { Sparkles } from "lucide-react";
import { HqAgentSuggestions } from "./hq-agent-suggestions";

export function HqAgentEmptyState({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-2 pt-6 text-center sm:pt-10">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-card bg-cobalt/10 text-cobalt"
        aria-hidden
      >
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="space-y-1.5">
        <h2 className="font-display text-lg font-semibold text-ink sm:text-xl">
          Ask anything about the Brandscope business.
        </h2>
        <p className="text-sm text-ink-secondary">
          Get live answers across customers, revenue, campaigns, operations and AI usage.
        </p>
      </div>
      <div className="w-full pt-1">
        <HqAgentSuggestions suggestions={suggestions} onPick={onPick} />
      </div>
    </div>
  );
}
