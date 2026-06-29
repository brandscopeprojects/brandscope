// RegulatoryComplianceMatrix — the compliance matrix for Screen 12 (/regulatory).
// Rows = own brand (cobalt-highlighted, top) + competitors; columns = the six
// regulatory dimensions + a Total/score column. Each cell is a status glyph
// driven by design tokens (ui-constraints §2.3 / §12):
//   compliant → green ✓ (opportunity)   partial → amber ⚠ (watch)
//   missing / violation → red ✗ (urgent)   unknown → neutral grey "–"
// Bespoke table (not DataTable) because the cells are centred glyphs and the
// matrix scrolls horizontally on mobile. Inter cells, base-secondary header zone,
// mono score. Presentational. Tokens only.

import type {
  ComplianceRow,
  ComplianceStatus,
  RegulatoryDimensionKey,
} from "@/lib/data/regulatory";
import { REGULATORY_DIMENSIONS } from "@/lib/data/regulatory";
import { TierBadge } from "@/components/intelligence/TierBadge";

type Glyph = { glyph: string; className: string; srLabel: string };

const STATUS_GLYPH: Record<ComplianceStatus, Glyph> = {
  compliant: { glyph: "✓", className: "text-opportunity", srLabel: "Compliant" },
  partial: { glyph: "⚠", className: "text-watch", srLabel: "Partial" },
  missing: { glyph: "✗", className: "text-urgent", srLabel: "Missing" },
  violation: { glyph: "✗", className: "text-urgent", srLabel: "Violation" },
  unknown: { glyph: "–", className: "text-ink-faint", srLabel: "Not scored" },
};

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="font-mono text-[13px] text-ink-faint">—</span>;
  }
  const tone =
    score >= 80 ? "text-opportunity" : score >= 50 ? "text-watch" : "text-urgent";
  return (
    <span className={`font-mono text-[13px] font-medium ${tone}`}>
      {score}
      <span className="text-ink-faint">/100</span>
    </span>
  );
}

function Legend() {
  const items: { label: string; status: ComplianceStatus }[] = [
    { label: "Compliant", status: "compliant" },
    { label: "Partial", status: "partial" },
    { label: "Missing / violation", status: "missing" },
    { label: "Not scored", status: "unknown" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 pt-3 text-xs text-ink-secondary">
      {items.map((i) => {
        const g = STATUS_GLYPH[i.status];
        return (
          <span key={i.label} className="inline-flex items-center gap-1.5">
            <span className={`text-sm leading-none ${g.className}`} aria-hidden>
              {g.glyph}
            </span>
            {i.label}
          </span>
        );
      })}
    </div>
  );
}

export function RegulatoryComplianceMatrix({ rows }: { rows: ComplianceRow[] }) {
  return (
    <div>
      <div className="overflow-x-auto rounded-card border border-divider bg-card">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-base-secondary">
              <th className="sticky left-0 z-10 w-[148px] min-w-[148px] bg-base-secondary px-4 py-2.5 text-left text-xs font-medium text-ink-secondary">
                Brand
              </th>
              {REGULATORY_DIMENSIONS.map((d) => (
                <th
                  key={d.key}
                  className="px-3 py-2.5 text-center text-xs font-medium text-ink-secondary"
                >
                  {d.label}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-secondary">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const highlighted = row.isOwnBrand;
              return (
                <tr
                  key={row.competitorId}
                  className={[
                    "border-t border-divider",
                    highlighted ? "bg-cobalt/5" : "",
                  ].join(" ")}
                >
                  <th
                    scope="row"
                    className={[
                      "sticky left-0 z-10 w-[148px] min-w-[148px] px-4 py-3 text-left",
                      // Opaque card base so the sticky cell covers scrolled content;
                      // the cobalt tint sits on top for the own-brand row.
                      "bg-card",
                      highlighted ? "before:absolute before:inset-0 before:bg-cobalt/5" : "",
                    ].join(" ")}
                  >
                    <span className="relative z-10 flex min-w-0 flex-col items-start gap-1">
                      <span
                        className={[
                          "max-w-full truncate text-sm",
                          highlighted
                            ? "font-semibold text-cobalt"
                            : "font-medium text-ink",
                        ].join(" ")}
                      >
                        {row.name}
                      </span>
                      {highlighted ? (
                        <span className="rounded-chip bg-cobalt/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cobalt">
                          You
                        </span>
                      ) : (
                        <TierBadge tier={row.tier} />
                      )}
                    </span>
                  </th>

                  {REGULATORY_DIMENSIONS.map((d) => {
                    const status = row.statuses[d.key as RegulatoryDimensionKey];
                    const g = STATUS_GLYPH[status];
                    return (
                      <td key={d.key} className="px-3 py-3 text-center">
                        <span
                          className={`text-base leading-none ${g.className}`}
                          title={g.srLabel}
                        >
                          <span aria-hidden>{g.glyph}</span>
                          <span className="sr-only">{g.srLabel}</span>
                        </span>
                      </td>
                    );
                  })}

                  <td className="px-4 py-3 text-right">
                    <ScoreCell score={row.score} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Legend />
    </div>
  );
}
