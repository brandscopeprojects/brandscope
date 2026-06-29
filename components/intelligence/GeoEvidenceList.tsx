// GeoEvidenceList — small evidence list for the GEO page (Screen 14): notable AI
// mentions / featured snippets feeding AI answers. Source URLs in mono cobalt
// (ui-constraints §9 evidence: real styled links, JetBrains Mono). Each item may
// carry a platform/query label and a verbatim snippet. Presentational, tokens only.

export type GeoEvidenceItem = {
  /** Platform name (mentions) or query (snippets). */
  label?: string | null;
  url: string;
  snippet?: string | null;
};

export function GeoEvidenceList({
  title,
  items,
}: {
  title: string;
  items: GeoEvidenceItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-card bg-card p-5 shadow-sh1">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={`${item.url}-${i}`} className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-2">
              {item.label && (
                <span className="rounded-chip bg-base-secondary px-2 py-0.5 text-xs font-medium text-ink-secondary">
                  {item.label}
                </span>
              )}
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-xs text-cobalt hover:underline"
              >
                {item.url}
              </a>
            </div>
            {item.snippet && (
              <p className="border-l-2 border-divider pl-3 text-sm leading-6 text-ink-secondary">
                {item.snippet}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
