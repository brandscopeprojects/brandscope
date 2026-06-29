// HealthStatusStrip — internal-admin top-level system status tiles (Screen 24).
// Data-dense per ui-constraints §11.3. Leftmost tile = overall status pill +
// active-incident count; the remaining tiles are one real per-service snapshot
// each. Status via StatusPill (good/warn/bad/neutral). Timestamps in mono.
// Presentational. Tokens only.

import { StatusPill } from "@/components/intelligence/StatusPill";
import type { SystemStatusVM } from "@/lib/data/internal-health";

export function HealthStatusStrip({ status }: { status: SystemStatusVM }) {
  return (
    <section aria-label="System status" className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Overall status tile */}
        <div className="rounded-card bg-card p-4 shadow-sh1">
          <p className="text-xs text-ink-secondary">Overall status</p>
          <div className="mt-2">
            <StatusPill label={status.overallStatusLabel} tone={status.overallStatusTone} />
          </div>
          <p className="mt-3 text-xs text-ink-secondary">
            Active incidents{" "}
            <span
              className={`font-mono text-[13px] font-medium ${
                status.activeIncidents > 0 ? "text-urgent" : "text-ink"
              }`}
            >
              {status.activeIncidents}
            </span>
          </p>
        </div>

        {/* Per-service snapshot tiles (real rows only) */}
        {status.services.map((svc) => (
          <div key={svc.id} className="rounded-card bg-card p-4 shadow-sh1">
            <p className="truncate text-xs text-ink-secondary" title={svc.name}>
              {svc.name}
            </p>
            <div className="mt-2">
              <StatusPill label={svc.statusLabel} tone={svc.tone} />
            </div>
            {svc.detail && (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink-secondary">
                {svc.detail}
              </p>
            )}
            <p className="mt-2 font-mono text-[11px] text-ink-faint">{svc.checkedAt}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
