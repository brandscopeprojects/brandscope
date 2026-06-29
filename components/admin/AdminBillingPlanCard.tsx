// AdminBillingPlanCard — current plan summary for the brand-admin Billing page
// (Screen 23). Shows plan name, status pill, monthly price (Syne metric), renewal
// date (mono), and an HONEST disabled "Manage / upgrade" control — there is no
// payment integration at MVP (read-only), so we never fake a checkout flow.
// Presentational. Tokens only.

import { StatusPill } from "@/components/intelligence/StatusPill";
import type { PlanView } from "@/lib/data/admin-billing";

export function AdminBillingPlanCard({ plan }: { plan: PlanView }) {
  return (
    <section className="rounded-card bg-card p-6 shadow-sh1">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold text-ink">{plan.name}</h2>
            <StatusPill label={plan.status.label} tone={plan.status.tone} />
          </div>

          <div className="flex items-baseline gap-1">
            <span className="font-display text-3xl font-bold leading-none text-ink">
              {plan.priceLabel ?? "—"}
            </span>
            {plan.priceLabel && (
              <span className="text-sm text-ink-faint">/ month</span>
            )}
          </div>

          <dl className="space-y-1 pt-1 text-sm">
            <div className="flex flex-wrap items-center gap-x-2">
              <dt className="text-ink-secondary">
                {plan.cancelAtPeriodEnd ? "Ends" : "Renews"}
              </dt>
              <dd className="font-mono text-[13px] text-ink">
                {plan.renewsAtLabel ?? "—"}
              </dd>
            </div>
            {plan.trialEndsAtLabel && (
              <div className="flex flex-wrap items-center gap-x-2">
                <dt className="text-ink-secondary">Trial ends</dt>
                <dd className="font-mono text-[13px] text-ink">
                  {plan.trialEndsAtLabel}
                </dd>
              </div>
            )}
          </dl>

          {plan.cancelAtPeriodEnd && (
            <p className="pt-1 text-xs text-watch">
              Your subscription is set to end at the end of the current period.
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Self-service plan changes are coming soon. Contact your account manager to upgrade."
            className="cursor-not-allowed rounded-chip border border-divider bg-base-secondary px-4 py-2 text-sm font-medium text-ink-faint"
          >
            Manage / upgrade
          </button>
          <span className="max-w-[12rem] text-right text-[11px] leading-4 text-ink-faint">
            Self-service plan changes coming soon — contact your account manager.
          </span>
        </div>
      </div>
    </section>
  );
}
