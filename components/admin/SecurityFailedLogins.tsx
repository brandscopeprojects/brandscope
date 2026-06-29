// SecurityFailedLogins — recent failed login attempts for the Security Centre
// (Screen 28). Email, IP (mono), attempts (mono), reason, status, last attempt
// (mono). Security-negative: tones are urgent (blocked) / watch (other) — never
// green. Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import type { FailedLoginVM } from "@/lib/data/internal-security";

const columns: Column<FailedLoginVM>[] = [
  {
    key: "email",
    header: "Email",
    cell: (r) => <span className="font-medium text-ink">{r.email}</span>,
  },
  { key: "ip", header: "IP address", cell: (r) => r.ip, mono: true },
  {
    key: "location",
    header: "Location",
    cell: (r) => r.location ?? "—",
  },
  {
    key: "attempts",
    header: "Attempts",
    cell: (r) => r.attempts,
    align: "right",
    mono: true,
  },
  { key: "reason", header: "Reason", cell: (r) => r.reason },
  {
    key: "status",
    header: "Status",
    cell: (r) => <StatusPill label={r.statusLabel} tone={r.statusTone} />,
  },
  {
    key: "lastAttempt",
    header: "Last attempt",
    cell: (r) => r.lastAttempt,
    mono: true,
  },
];

export function SecurityFailedLogins({ rows }: { rows: FailedLoginVM[] }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      emptyLabel="No failed login attempts."
    />
  );
}
