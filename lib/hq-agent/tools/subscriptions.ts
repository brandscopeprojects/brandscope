import "server-only";

import type { HqTool } from "../types";
import { PERIOD_PARAM, validatePeriodArg, resolvePeriod, kobo, countBy, nowIso } from "./shared";

/** get_subscription_metrics — active/trials + upgrades/downgrades/cancellations. */
const subscriptionMetrics: HqTool = {
  name: "get_subscription_metrics",
  category: "subscriptions",
  description:
    "Subscription state and movement: active/trialing/past_due/canceled counts, MRR total, and upgrades/downgrades/cancellations within the period (from churn_events). Use for subscription health and churn-movement questions.",
  parameters: { type: "object", properties: { ...PERIOD_PARAM }, additionalProperties: false },
  validate: validatePeriodArg,
  run: async ({ admin }, args) => {
    const period = resolvePeriod(args.period);
    const [{ data: subs }, { data: events }] = await Promise.all([
      admin.from("subscriptions").select("plan, status, mrr_kobo"),
      admin
        .from("churn_events")
        .select("event_type, from_plan, to_plan, mrr_delta_kobo, occurred_at")
        .gte("occurred_at", period.sinceIso)
        .order("occurred_at", { ascending: false })
        .limit(500),
    ]);
    const active = (subs ?? []).filter((s) => s.status === "active" || s.status === "trialing");
    const mrrTotal = active.reduce((a, s) => a + kobo(s.mrr_kobo), 0);
    return {
      data: {
        by_status: countBy(subs ?? [], (s) => s.status ?? "unknown"),
        active_subscriptions: (subs ?? []).filter((s) => s.status === "active").length,
        trials: (subs ?? []).filter((s) => s.status === "trialing").length,
        mrr_ngn_total: mrrTotal,
        mrr_ngn_by_plan: active.reduce<Record<string, number>>((acc, s) => {
          acc[s.plan] = (acc[s.plan] ?? 0) + kobo(s.mrr_kobo);
          return acc;
        }, {}),
        movement_in_period: {
          window: period.label,
          upgrades: (events ?? []).filter((e) => e.event_type === "upgrade").length,
          downgrades: (events ?? []).filter((e) => e.event_type === "downgrade").length,
          cancellations: (events ?? []).filter((e) => e.event_type === "cancellation" || e.event_type === "churn").length,
          net_mrr_delta_ngn: (events ?? []).reduce((a, e) => a + kobo(e.mrr_delta_kobo), 0),
        },
      },
      dataUpdatedAt: nowIso(),
      sources: [{ service: "subscriptions + churn_events", dateRange: period.label, updatedAt: nowIso() }],
    };
  },
};

export const subscriptionTools: HqTool[] = [subscriptionMetrics];
