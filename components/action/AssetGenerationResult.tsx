"use client";

// AssetGenerationResult — generated asset output, rendered INLINE below the action card
// (ui-constraints §10, screen-specs Screen 32). NEVER a modal — it must stay connected
// to its evidence.
// Header bar (asset type + "New" badge) → sections → channel chips + budget → footer
// actions (Copy All / Edit / Save to Library / Share).
// Loading state = small spinner + "Writing your campaign brief…".
// Tokens only. Cobalt reserved for the "New" badge accent + nothing decorative.

type AssetSection = { label: string; body: string };

type GeneratedAsset = {
  type: string;
  title: string;
  sections: AssetSection[];
  channels?: string[];
  budget?: string;
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-divider border-t-cobalt"
    />
  );
}

export function AssetGenerationResult({
  loading,
  asset,
}: {
  loading?: boolean;
  asset?: GeneratedAsset;
}) {
  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-card border border-divider bg-card px-4 py-3 text-sm text-ink-secondary shadow-sh1">
        <Spinner />
        <span>Writing your campaign brief…</span>
      </div>
    );
  }

  if (!asset) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-card border border-divider bg-card shadow-sh1">
      {/* Header bar — asset type + New badge */}
      <div className="flex items-center justify-between gap-2 bg-base-secondary px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
          {asset.type}
        </span>
        <span className="inline-flex items-center rounded-chip bg-cobalt px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          New
        </span>
      </div>

      <div className="space-y-4 px-4 py-4">
        {asset.title && (
          <h4 className="text-sm font-semibold text-ink">{asset.title}</h4>
        )}

        {/* Sections */}
        <div className="space-y-3">
          {asset.sections.map((section, i) => (
            <div key={i} className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
                {section.label}
              </p>
              <p className="whitespace-pre-line text-sm leading-6 text-ink">
                {section.body}
              </p>
            </div>
          ))}
        </div>

        {/* Recommended channels */}
        {asset.channels && asset.channels.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
              Recommended Channels
            </p>
            <div className="flex flex-wrap gap-2">
              {asset.channels.map((channel) => (
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

        {/* Budget recommendation */}
        {asset.budget && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
              Budget Recommendation
            </p>
            <p className="font-mono text-sm text-ink">{asset.budget}</p>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-divider px-4 py-2.5">
        <button
          type="button"
          className="text-xs font-medium text-cobalt transition-colors hover:underline"
        >
          Copy All
        </button>
        <button
          type="button"
          className="text-xs font-medium text-ink-secondary transition-colors hover:text-ink"
        >
          Edit
        </button>
        <button
          type="button"
          className="text-xs font-medium text-ink-secondary transition-colors hover:text-ink"
        >
          Save to Library
        </button>
        <button
          type="button"
          className="text-xs font-medium text-ink-secondary transition-colors hover:text-ink"
        >
          Share
        </button>
      </div>
    </div>
  );
}
