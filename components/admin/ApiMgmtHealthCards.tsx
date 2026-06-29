// ApiMgmtHealthCards — one card per external provider (api_health_logs latest row).
// Status pill + mono latency / error rate / last-checked. Internal admin is the
// data-dense surface (ui-constraints §11.3): table-heavy, mono for evidence values.
// Presentational. Tokens only.

import { StatusPill } from "@/components/intelligence/StatusPill";
import type { ApiHealthView } from "@/lib/data/internal-api";

function formatLatency(ms: number | null): string {
  return ms == null ? "—" : `${ms} ms`;
}

function formatErrorRate(rate: number | null): string {
  return rate == null ? "—" : `${rate.toFixed(rate % 1 === 0 ? 0 : 1)}%`;
}

function formatChecked(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function formatCredit(balance: number | null, currency: string | null): string | null {
  if (balance == null) return null;
  const cur = currency ? `${currency} ` : "";
  return `${cur}${balance.toLocaleString("en-GB")}`;
}

export function ApiMgmtHealthCards({ health }: { health: ApiHealthView[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-ink">Provider health</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {health.map((p) => {
          const credit = formatCredit(p.creditBalance, p.creditCurrency);
          return (
            <div key={p.id} className="rounded-card bg-card p-4 shadow-sh1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{p.provider}</p>
                <StatusPill label={p.statusLabel} tone={p.tone} />
              </div>

              <dl className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-xs text-ink-secondary">Latency</dt>
                  <dd className="font-mono text-[13px] text-ink">
                    {formatLatency(p.latencyMs)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-xs text-ink-secondary">Error rate (24h)</dt>
                  <dd
                    className={`font-mono text-[13px] ${
                      p.errorRate24h != null && p.errorRate24h >= 5
                        ? "text-urgent"
                        : "text-ink"
                    }`}
                  >
                    {formatErrorRate(p.errorRate24h)}
                  </dd>
                </div>
                {credit && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-xs text-ink-secondary">Credit</dt>
                    <dd className="font-mono text-[13px] text-ink">{credit}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-xs text-ink-secondary">Last checked</dt>
                  <dd className="font-mono text-[13px] text-ink-faint">
                    {formatChecked(p.checkedAt)}
                  </dd>
                </div>
              </dl>

              {p.errorMessage && (
                <p className="mt-3 rounded-chip bg-urgent/10 px-2 py-1 font-mono text-[11px] leading-5 text-urgent">
                  {p.errorMessage}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
