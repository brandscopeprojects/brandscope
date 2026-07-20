"use client";

// Hq Agent — suggestion chips. A wrapped row of tappable prompts.

export function HqAgentSuggestions({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (prompt: string) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="max-w-full rounded-chip border border-divider bg-card px-3 py-2 text-left text-xs text-ink-secondary shadow-sh1 transition-colors hover:border-cobalt hover:text-ink focus:outline-none focus-visible:border-cobalt focus-visible:ring-2 focus-visible:ring-cobalt/40"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
