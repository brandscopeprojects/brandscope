// PromotionsSignalsTable — detected competitor promotion signals (Screen 6,
// `/promotions`). Built on the shared DataTable + StatusPill + WoWIndicator +
// TierBadge primitives.
//
// SIGNALS-ONLY POLICY (mvp-constraints.md module 8): this table shows that a
// promo EXISTS, its TYPE, whether it is NEW, and the DIRECTION of a WoW change —
// never an exact bonus amount or wagering requirement. The data layer
// (`lib/data/promotions.ts`) already withholds those figures; this component must
// not reintroduce them. Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import { WoWIndicator } from "@/components/intelligence/WoWIndicator";
import { TierBadge } from "@/components/intelligence/TierBadge";
import type { PromotionSignal } from "@/lib/data/promotions";

function formatScrapedAt(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

const columns: Column<PromotionSignal>[] = [
  {
    key: "competitor",
    header: "Competitor",
    cell: (s) => (
      <span className="inline-flex items-center gap-2">
        <span className="font-medium text-ink">{s.name}</span>
        <TierBadge tier={s.tier} />
      </span>
    ),
  },
  {
    key: "promotion",
    header: "Promotion",
    cell: (s) => s.promoTitle ?? <span className="text-ink-faint">—</span>,
  },
  {
    key: "type",
    header: "Type",
    cell: (s) =>
      s.promoType ? (
        <span className="inline-flex items-center rounded-chip bg-base-secondary px-2 py-0.5 text-xs font-medium text-ink-secondary">
          {s.promoType}
        </span>
      ) : (
        <span className="text-ink-faint">—</span>
      ),
  },
  {
    key: "isNew",
    header: "New?",
    align: "center",
    cell: (s) =>
      s.isNew ? <StatusPill label="New" tone="good" /> : <span className="text-ink-faint">—</span>,
  },
  {
    key: "trend",
    header: "Trend",
    align: "right",
    // wow_bonus_change_pct is a DELTA (directional signal), not the bonus amount —
    // permitted under the signals-only policy. Show direction + magnitude of change.
    cell: (s) =>
      s.wowBonusChangePct != null && s.wowBonusChangePct !== 0 ? (
        <WoWIndicator delta={s.wowBonusChangePct} suffix="%" />
      ) : (
        <span className="text-ink-faint">—</span>
      ),
  },
  {
    key: "source",
    header: "Source",
    cell: (s) => {
      const href = s.sourceUrl ?? s.promoUrl;
      const scraped = formatScrapedAt(s.scrapedAt);
      if (!href) {
        return scraped ? (
          <span className="font-mono text-[13px] text-ink-faint">{scraped}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        );
      }
      return (
        <span className="flex flex-col gap-0.5">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-mono text-[13px] text-cobalt hover:underline"
          >
            View source
          </a>
          {scraped && <span className="font-mono text-[11px] text-ink-faint">{scraped}</span>}
        </span>
      );
    },
  },
];

export function PromotionsSignalsTable({ rows }: { rows: PromotionSignal[] }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(s) => `${s.competitorId}:${s.promoTitle ?? s.evidenceHash ?? ""}`}
      emptyLabel="No promotion signals in this week's scan."
    />
  );
}
