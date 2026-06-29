"use client";

// ChatSuggestedPrompts — the starter surface shown when the brand has no
// conversations yet (Screen 19). Static example questions; tapping one submits it
// as the first message and starts a new conversation. These are example PROMPTS,
// not data — they don't claim any answer, so they're not fabricated content.
// Tokens only.

const PROMPTS: readonly string[] = [
  "Which competitor gained the most market share this week?",
  "How does our welcome bonus compare to the market standard?",
  "Where are we losing AI visibility across ChatGPT, Claude, Gemini and Perplexity?",
  "Which competitors have open regulatory compliance gaps?",
  "What's the single highest-priority action for us this week?",
];

export function ChatSuggestedPrompts({
  onSelect,
  disabled,
}: {
  onSelect: (prompt: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-ink-secondary">
        Try asking
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onSelect(prompt)}
              disabled={disabled}
              className="w-full rounded-card border border-divider bg-card px-4 py-3 text-left text-sm leading-6 text-ink shadow-sh1 transition-colors hover:border-cobalt/40 disabled:opacity-50"
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
