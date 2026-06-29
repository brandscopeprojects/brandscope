// TechStackTable — per-competitor technology-category breakdown for /tech-stack
// (Screen 9). One row per tracked competitor with the detected Analytics, CDN,
// Payments and CRM technologies rendered as chips. Built on the shared DataTable
// primitive. Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { TechStackChips } from "@/components/intelligence/TechStackChips";
import type { CompetitorTechStack } from "@/lib/data/tech-stack";

const columns: Column<CompetitorTechStack>[] = [
  {
    key: "competitor",
    header: "Competitor",
    cell: (row) => <span className="font-medium text-ink">{row.name}</span>,
  },
  {
    key: "analytics",
    header: "Analytics",
    cell: (row) => <TechStackChips items={row.analyticsTools} />,
  },
  {
    key: "cdn",
    header: "CDN",
    cell: (row) => <TechStackChips items={row.cdnProviders} />,
  },
  {
    key: "payments",
    header: "Payments",
    cell: (row) => <TechStackChips items={row.paymentGateways} />,
  },
  {
    key: "crm",
    header: "CRM",
    cell: (row) => <TechStackChips items={row.crmTools} />,
  },
];

export function TechStackTable({ rows }: { rows: CompetitorTechStack[] }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.competitorId}
      emptyLabel="No technologies detected yet."
    />
  );
}
