// ApiMgmtCircuitBreaker — per-provider circuit state DERIVED from real
// api_health_logs fields (status + error_rate_24h) and the configured
// circuit_breaker_threshold_pct. NOT fabricated: every value shown is read or
// directly derived from a stored field.
//   closed    → traffic flows (green)
//   half-open → degraded / elevated error rate, probing (amber)
//   open      → tripped, provider down / error rate over threshold (red)
// Presentational. Tokens only.

import { StatusPill } from "@/components/intelligence/StatusPill";
import type { ApiHealthView, CircuitState } from "@/lib/data/internal-api";

const CIRCUIT: Record<CircuitState, { label: string; tone: "good" | "warn" | "bad" }> = {
  closed: { label: "Closed", tone: "good" },
  "half-open": { label: "Half-open", tone: "warn" },
  open: { label: "Open", tone: "bad" },
};

function formatErrorRate(rate: number | null): string {
  return rate == null ? "—" : `${rate.toFixed(rate % 1 === 0 ? 0 : 1)}%`;
}

export function ApiMgmtCircuitBreaker({ health }: { health: ApiHealthView[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Circuit breakers</h2>
        <p className="text-xs text-ink-faint">
          Derived from provider status and 24h error rate.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {health.map((p) => {
          const c = CIRCUIT[p.circuit];
          return (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-card bg-card p-3.5 shadow-sh1"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{p.provider}</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                  err {formatErrorRate(p.errorRate24h)}
                </p>
              </div>
              <StatusPill label={c.label} tone={c.tone} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
