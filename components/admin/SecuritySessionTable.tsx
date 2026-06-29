// SecuritySessionTable — current active sessions for the Security Centre
// (Screen 28). User/email, IP (mono), device, last active (mono), status pill.
// Presentational. Tokens only.

import { DataTable, type Column } from "@/components/intelligence/DataTable";
import { StatusPill } from "@/components/intelligence/StatusPill";
import type { SessionVM } from "@/lib/data/internal-security";

const columns: Column<SessionVM>[] = [
  {
    key: "user",
    header: "User",
    cell: (r) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-ink">{r.user}</div>
        {r.email && (
          <div className="truncate text-xs text-ink-secondary">{r.email}</div>
        )}
      </div>
    ),
  },
  { key: "role", header: "Role", cell: (r) => r.role },
  { key: "ip", header: "IP address", cell: (r) => r.ip, mono: true },
  { key: "device", header: "Device", cell: (r) => r.device },
  {
    key: "location",
    header: "Location",
    cell: (r) => r.location ?? "—",
  },
  {
    key: "lastActive",
    header: "Last active",
    cell: (r) => r.lastActive,
    mono: true,
  },
  {
    key: "status",
    header: "Status",
    cell: (r) => <StatusPill label={r.statusLabel} tone={r.statusTone} />,
  },
];

export function SecuritySessionTable({ sessions }: { sessions: SessionVM[] }) {
  return (
    <DataTable
      columns={columns}
      rows={sessions}
      getRowKey={(r) => r.id}
      emptyLabel="No active sessions."
    />
  );
}
