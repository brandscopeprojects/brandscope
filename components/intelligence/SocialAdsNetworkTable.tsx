// SocialAdsNetworkTable — ad-network presence table for /social-ads (Screen 8).
// One row per tracked competitor: name + tier and the detected ad networks as
// neutral chips. Sourced from tech_stack_cache (DetectZeStack) — the same data
// the full /tech-stack page shows — so a cobalt link points there for depth.
// Built on the shared DataTable primitive. Presentational. Tokens only.

import Link from "next/link";
import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { TierBadge } from "@/components/intelligence/TierBadge";
import { TechStackChips } from "@/components/intelligence/TechStackChips";
import type { CompetitorAdNetworks } from "@/lib/data/social-ads";

const columns: Column<CompetitorAdNetworks>[] = [
  {
    key: "competitor",
    header: "Competitor",
    cell: (row) => (
      <div className="flex flex-wrap items-center gap-2">
        <span className={row.isOwnBrand ? "font-semibold text-cobalt" : "font-medium text-ink"}>
          {row.name}
        </span>
        {row.isOwnBrand ? (
          // Own brand → cobalt "You" marker, never a tier badge (ui-constraints §2.2).
          <span className="rounded-chip bg-cobalt/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cobalt">
            You
          </span>
        ) : (
          <TierBadge tier={row.tier} />
        )}
      </div>
    ),
  },
  {
    key: "adNetworks",
    header: "Ad Networks",
    cell: (row) => <TechStackChips items={row.adNetworks} />,
  },
];

export function SocialAdsNetworkTable({ rows }: { rows: CompetitorAdNetworks[] }) {
  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.competitorId}
        isHighlighted={(row) => row.isOwnBrand}
        emptyLabel="No ad networks detected yet."
      />
      <Link
        href="/tech-stack"
        className="inline-flex items-center text-sm font-medium text-cobalt hover:underline"
      >
        View full tech stack &rarr;
      </Link>
    </div>
  );
}
