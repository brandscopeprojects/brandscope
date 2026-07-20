import "server-only";

import type { HqTool } from "../types";
import { PERIOD_PARAM, validatePeriodArg, resolvePeriod, kobo, countBy, nowIso } from "./shared";

/** get_revenue_summary — MRR, recurring-revenue movement, plan revenue, comparison. */
const revenueSummary: HqTool = {
  name: "get_revenue_summary",
  category: "finance",
  description:
    "Revenue view: current MRR by plan (NGN), payments received in the period, weekly revenue_metrics (MRR, revenue, recorded infra/api cost, gross margin), and period-over-period MRR movement. Only reports figures that have reliable source rows. Use for revenue, MRR, P&L, margin questions.",
  parameters: { type: "object", properties: { ...PERIOD_PARAM }, additionalProperties: false },
  validate: validatePeriodArg,
  run: async ({ admin }, args) => {
    const period = resolvePeriod(args.period);
    const [{ data: subs }, { data: pays }, { data: weeks }] = await Promise.all([
      admin.from("subscriptions").select("plan, status, mrr_kobo"),
      admin
        .from("payment_history")
        .select("amount_kobo, status, paid_at, created_at")
        .gte("created_at", period.sinceIso)
        .limit(1000),
      admin
        .from("revenue_metrics")
        .select("period_week, mrr_kobo, revenue_kobo, active_brands, new_brands, churned_brands, infra_cost_kobo, api_cost_kobo, gross_margin_pct")
        .order("period_week", { ascending: false })
        .limit(12),
    ]);
    const active = (subs ?? []).filter((s) => s.status === "active" || s.status === "trialing");
    const mrrByPlan = active.reduce<Record<string, number>>((acc, s) => {
      acc[s.plan] = (acc[s.plan] ?? 0) + kobo(s.mrr_kobo);
      return acc;
    }, {});
    const paid = (pays ?? []).filter((p) => p.status === "paid");
    const w = weeks ?? [];
    const mrrMovement =
      w.length >= 2 ? { latest_week: w[0].period_week, latest_mrr_ngn: kobo(w[0].mrr_kobo), prior_mrr_ngn: kobo(w[1].mrr_kobo), delta_ngn: kobo(w[0].mrr_kobo) - kobo(w[1].mrr_kobo) } : null;
    return {
      data: {
        note: "Amounts are NGN (from *_kobo). Provider (DataForSEO) cost is metered separately in llm_usage; P&L cost here is only what revenue_metrics recorded.",
        mrr_ngn_by_plan: mrrByPlan,
        mrr_ngn_total: Object.values(mrrByPlan).reduce((a, b) => a + b, 0),
        payments_in_period: {
          window: period.label,
          paid_count: paid.length,
          paid_total_ngn: paid.reduce((a, p) => a + kobo(p.amount_kobo), 0),
          by_status: countBy(pays ?? [], (p) => p.status),
        },
        weekly_revenue_metrics: w,
        mrr_movement: mrrMovement,
      },
      dataUpdatedAt: w[0]?.period_week ?? nowIso(),
      sources: [{ service: "subscriptions + payment_history + revenue_metrics", dateRange: period.label, updatedAt: w[0]?.period_week ?? null }],
    };
  },
};

export const financeTools: HqTool[] = [revenueSummary];
