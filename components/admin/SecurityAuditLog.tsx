// SecurityAuditLog — recent privileged actions for the Security Centre
// (Screen 28), read from audit_logs. Actor, action, target, IP (mono), time
// (mono). Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import type { AuditLogVM } from "@/lib/data/internal-security";

const columns: Column<AuditLogVM>[] = [
  {
    key: "actor",
    header: "Actor",
    cell: (r) => <span className="font-medium text-ink">{r.actor}</span>,
  },
  {
    key: "action",
    header: "Action",
    cell: (r) => <span className="font-mono text-[13px]">{r.action}</span>,
  },
  { key: "target", header: "Target", cell: (r) => r.target },
  { key: "ip", header: "IP address", cell: (r) => r.ip, mono: true },
  { key: "time", header: "Time", cell: (r) => r.time, mono: true },
];

export function SecurityAuditLog({ rows }: { rows: AuditLogVM[] }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      emptyLabel="No audit events."
    />
  );
}
