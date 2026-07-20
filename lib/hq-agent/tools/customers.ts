import "server-only";

import type { HqTool } from "../types";
import { PERIOD_PARAM, validatePeriodArg, resolvePeriod, countBy, weekOf, nowIso } from "./shared";

/** get_brand_registration_summary — registrations by plan + over time. */
const brandRegistrationSummary: HqTool = {
  name: "get_brand_registration_summary",
  category: "customers",
  description:
    "Registered brands over a period: total, newest brands (name, domain, markets, plan, signup date), signups per week, and plan distribution. Use for 'how many brands registered', signup growth, plan mix.",
  parameters: { type: "object", properties: { ...PERIOD_PARAM }, additionalProperties: false },
  validate: validatePeriodArg,
  run: async ({ admin }, args) => {
    const period = resolvePeriod(args.period);
    const { data: brands } = await admin
      .from("brands")
      .select("name, domain, market, organisation_id, created_at")
      .gte("created_at", period.sinceIso)
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: subs } = await admin.from("subscriptions").select("organisation_id, plan, status");
    const subByOrg = new Map((subs ?? []).map((s) => [s.organisation_id, s]));
    const rows = brands ?? [];
    const planOf = (orgId: string | null) => (orgId ? subByOrg.get(orgId)?.plan ?? "free" : "free");
    return {
      data: {
        total_new_brands: rows.length,
        signups_by_week: countBy(rows, (b) => weekOf(b.created_at as string)),
        plan_distribution: countBy(rows, (b) => planOf(b.organisation_id as string | null)),
        latest: rows.slice(0, 20).map((b) => ({
          name: b.name,
          domain: b.domain,
          markets: b.market,
          created_at: b.created_at,
          plan: planOf(b.organisation_id as string | null),
          subscription_status: b.organisation_id ? subByOrg.get(b.organisation_id)?.status ?? null : null,
        })),
      },
      dataUpdatedAt: rows[0]?.created_at ?? null,
      sources: [{ service: "brands + subscriptions", dateRange: period.label, updatedAt: rows[0]?.created_at ?? null }],
    };
  },
};

/** get_customer_risk_summary — HEURISTIC churn-risk from legitimate product signals. */
const customerRiskSummary: HqTool = {
  name: "get_customer_risk_summary",
  category: "customers",
  description:
    "Customers that may be at churn risk, scored by a HEURISTIC over legitimate product signals (subscription status past_due/canceled, trials ending, no recent scan activity, recent downgrades). Risk scores are heuristic, not fact. Use for 'which customers are at risk'.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  validate: () => ({}),
  run: async ({ admin }) => {
    const [{ data: subs }, { data: churn }, { data: scans }] = await Promise.all([
      admin.from("subscriptions").select("organisation_id, plan, status, mrr_kobo, current_period_end"),
      admin
        .from("churn_events")
        .select("organisation_id, event_type, from_plan, to_plan, occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(100),
      admin.from("scan_jobs").select("brand_id, created_at").order("created_at", { ascending: false }).limit(500),
    ]);
    const { data: brands } = await admin.from("brands").select("id, name, organisation_id");
    const brandByOrg = new Map<string, { id: string; name: string }>();
    for (const b of brands ?? []) if (b.organisation_id) brandByOrg.set(b.organisation_id, { id: b.id, name: b.name });
    const lastScanByBrand = new Map<string, string>();
    for (const s of scans ?? []) if (s.created_at && !lastScanByBrand.has(s.brand_id)) lastScanByBrand.set(s.brand_id, s.created_at);
    const recentDowngrades = new Set(
      (churn ?? []).filter((c) => c.event_type === "downgrade").map((c) => c.organisation_id),
    );

    const now = Date.now();
    const atRisk = (subs ?? [])
      .map((s) => {
        const reasons: string[] = [];
        let score = 0;
        if (s.status === "past_due") { score += 60; reasons.push("payment past due"); }
        if (s.status === "canceled") { score += 40; reasons.push("subscription canceled"); }
        if (s.status === "trialing" && s.current_period_end && new Date(s.current_period_end).getTime() - now < 5 * 864e5) {
          score += 30; reasons.push("trial ending within 5 days");
        }
        if (recentDowngrades.has(s.organisation_id)) { score += 25; reasons.push("recent downgrade"); }
        const brand = s.organisation_id ? brandByOrg.get(s.organisation_id) : undefined;
        const lastScan = brand ? lastScanByBrand.get(brand.id) : undefined;
        if (brand && (!lastScan || now - new Date(lastScan).getTime() > 21 * 864e5)) {
          score += 20; reasons.push("no scan activity in 21+ days");
        }
        return { brand: brand?.name ?? "(no brand)", plan: s.plan, status: s.status, heuristic_risk_score: Math.min(score, 100), reasons };
      })
      .filter((r) => r.heuristic_risk_score > 0)
      .sort((a, b) => b.heuristic_risk_score - a.heuristic_risk_score)
      .slice(0, 20);

    return {
      data: {
        disclaimer: "Risk scores are a heuristic derived from product signals, not a verified prediction.",
        at_risk_count: atRisk.length,
        at_risk: atRisk,
      },
      dataUpdatedAt: nowIso(),
      sources: [{ service: "subscriptions + churn_events + scan_jobs (heuristic)", updatedAt: nowIso() }],
    };
  },
};

export const customerTools: HqTool[] = [brandRegistrationSummary, customerRiskSummary];
