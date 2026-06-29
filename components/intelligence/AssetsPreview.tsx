// AssetsPreview — the inline, expanded preview of a stored asset's content
// (Screen 16). Rendered directly inside its AssetsCard when the card is expanded
// — INLINE, never a modal (ui-constraints §10). Mirrors the visual language of
// components/action/AssetGenerationResult.tsx (sections → channel chips → budget)
// but is its own component: this previews a *saved* library asset rather than a
// freshly generated one, so it carries no "New" badge and no generate-time footer
// actions. Presentational. Tokens only.

import type { AssetContent } from "@/lib/data/assets";

export function AssetsPreview({ content }: { content: AssetContent }) {
  const hasSections = content.sections.length > 0;
  const hasChannels = !!content.channels && content.channels.length > 0;

  if (!hasSections && !hasChannels && !content.budget) {
    return (
      <p className="px-4 py-4 text-sm text-ink-faint">
        This asset has no preview content.
      </p>
    );
  }

  return (
    <div className="space-y-4 border-t border-divider px-4 py-4">
      {/* Sections — label (uppercase, ink-secondary) + body (ink, preserves line breaks). */}
      {hasSections && (
        <div className="space-y-3">
          {content.sections.map((section, i) => (
            <div key={i} className="space-y-1">
              {section.label && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                  {section.label}
                </p>
              )}
              {section.body && (
                <p className="whitespace-pre-line text-sm leading-6 text-ink">
                  {section.body}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recommended channels — neutral chips. */}
      {hasChannels && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
            Recommended Channels
          </p>
          <div className="flex flex-wrap gap-2">
            {content.channels!.map((channel) => (
              <span
                key={channel}
                className="inline-flex items-center rounded-chip bg-base-secondary px-2.5 py-1 text-xs font-medium text-ink-secondary"
              >
                {channel}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Budget recommendation — mono (a data value pulled from the asset). */}
      {content.budget && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
            Budget Recommendation
          </p>
          <p className="font-mono text-sm text-ink">{content.budget}</p>
        </div>
      )}
    </div>
  );
}
