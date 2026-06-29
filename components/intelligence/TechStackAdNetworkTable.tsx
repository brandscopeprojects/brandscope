// TechStackAdNetworkTable — ad-network focus table for /tech-stack (Screen 9).
// One row per tracked competitor: name + tier, the detected ad networks rendered
// as chips, and the total distinct technology count (mono). Built on the shared
// DataTable primitive. Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { TierBadge } from "@/components/intelligence/TierBadge";
import { TechStackChips } from "@/components/intelligence/TechStackChips";
import type { CompetitorTechStack } from "@/lib/data/tech-stack";

const columns: Column<CompetitorTechStack>[] = [
  {
    key: "competitor",
    header: "Competitor",
    cell: (row) => (
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">{row.name}</span>
        <TierBadge tier={row.tier} />
      </div>
    ),
  },
  {
    key: "adNetworks",
    header: "Ad Networks",
    cell: (row) => <TechStackChips items={row.adNetworks} />,
  },
  {
    key: "technologyCount",
    header: "# Technologies",
    align: "right",
    mono: true,
    cell: (row) => row.technologyCount,
  },
];

export function TechStackAdNetworkTable({ rows }: { rows: CompetitorTechStack[] }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.competitorId}
      emptyLabel="No ad networks detected yet."
    />
  );
}
