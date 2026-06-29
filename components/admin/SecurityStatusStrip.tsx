// SecurityStatusStrip — headline security counts for the Security Centre
// (Screen 28). Wraps the shared StatStrip with real counts: active sessions,
// failed logins in the last 24h, and open alerts. Presentational. Tokens only.

import { StatStrip } from "@/components/intelligence/StatStrip";
import type { SecurityStatsVM } from "@/lib/data/internal-security";

export function SecurityStatusStrip({ stats }: { stats: SecurityStatsVM }) {
  return (
    <StatStrip
      stats={[
        { label: "Active sessions", value: stats.activeSessions },
        { label: "Failed logins (24h)", value: stats.failedLogins24h },
        { label: "Open alerts", value: stats.openAlerts },
      ]}
    />
  );
}
