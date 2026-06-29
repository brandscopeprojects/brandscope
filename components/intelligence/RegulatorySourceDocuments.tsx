// RegulatorySourceDocuments — the regulator filings behind the compliance call
// (Screen 12, /regulatory). Shared master data from regulatory_documents, scoped
// to the brand's markets. Each row is a citable source: regulator body + document
// name, type, version, and a mono "View source" link (ui-constraints §9, §12).
// Presentational. Tokens only.

import type { RegulatoryDocument } from "@/lib/data/regulatory";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function RegulatorySourceDocuments({
  documents,
}: {
  documents: RegulatoryDocument[];
}) {
  if (documents.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-card bg-card shadow-sh1">
      <header className="bg-base-secondary px-5 py-3">
        <h3 className="text-sm font-semibold text-ink">Regulatory sources</h3>
        <p className="mt-0.5 text-xs text-ink-secondary">
          Active regulator filings these compliance scores are checked against.
        </p>
      </header>
      <ul>
        {documents.map((doc) => {
          const verified = formatDate(doc.lastVerifiedAt);
          return (
            <li
              key={doc.id}
              className="flex flex-wrap items-start justify-between gap-3 border-t border-divider px-5 py-4 first:border-t-0"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-ink">{doc.documentName}</span>
                  <span className="rounded-chip bg-base-secondary px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-secondary">
                    {doc.documentType}
                  </span>
                </div>
                <p className="text-xs text-ink-secondary">
                  {doc.regulatoryBody} · {doc.country}
                  {doc.version ? ` · v${doc.version}` : ""}
                </p>
                {verified && (
                  <p className="font-mono text-[11px] text-ink-faint">
                    Last verified {verified}
                  </p>
                )}
              </div>
              <a
                href={doc.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 font-mono text-xs text-cobalt hover:underline"
              >
                View source
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
