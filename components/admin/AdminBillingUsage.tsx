// AdminBillingUsage — current billing-period usage for the brand-admin Billing
// page (Screen 23). Each metric renders as a progress bar (used vs plan limit)
// when a real limit exists; when the limit is unknown/unlimited we show the raw
// count only — never a fabricated bar. Real values only. Presentational, tokens.

import type { UsageView } from "@/lib/data/admin-billing";

export function AdminBillingUsage({ usage }: { usage: UsageView }) {
  return (
    <section className="rounded-card bg-card p-6 shadow-sh1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ink">Usage</h2>
        {usage.periodLabel && (
          <span className="font-mono text-xs text-ink-faint">
            {usage.periodLabel}
          </span>
        )}
      </div>

      {usage.metrics.length === 0 ? (
        <p className="mt-3 text-sm text-ink-faint">
          No usage recorded for this period yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {usage.metrics.map((m) => {
            const hasLimit = m.limit != null && m.limit > 0;
            const pct = hasLimit
              ? Math.min(100, Math.round((m.used / (m.limit as number)) * 100))
              : 0;
            const atLimit = hasLimit && m.used >= (m.limit as number);
            return (
              <li key={m.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-ink-secondary">{m.label}</span>
                  <span className="font-mono text-[13px] text-ink">
                    {m.used.toLocaleString("en-NG")}
                    {hasLimit && (
                      <span className="text-ink-faint">
                        {" "}
                        / {(m.limit as number).toLocaleString("en-NG")}
                      </span>
                    )}
                  </span>
                </div>
                {hasLimit ? (
                  <div
                    className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-base-secondary"
                    role="progressbar"
                    aria-valuenow={m.used}
                    aria-valuemin={0}
                    aria-valuemax={m.limit as number}
                    aria-label={m.label}
                  >
                    <div
                      className={`h-full rounded-full ${atLimit ? "bg-urgent" : "bg-cobalt"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-ink-faint">No plan limit set.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
