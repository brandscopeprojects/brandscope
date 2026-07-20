import "server-only";

import type { HqTool } from "../types";
import { nowIso } from "./shared";

/** get_provider_health — model/provider reliability from real signals. */
const providerHealth: HqTool = {
  name: "get_provider_health",
  category: "provider_health",
  description:
    "Provider/model health: per-model error rate and last-successful-call from recent agent_job_logs, the router config (circuit-breaker threshold, active/inactive), and DataForSEO spend recency. Use for 'are any providers degraded', integration reliability.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  validate: () => ({}),
  run: async ({ admin }) => {
    const since = new Date(Date.now() - 3 * 864e5).toISOString();
    const [{ data: jobs }, { data: router }, { data: spend }] = await Promise.all([
      admin.from("agent_job_logs").select("model_used, status, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
      admin.from("model_router_config").select("task_type, primary_model, is_active, circuit_breaker_threshold_pct"),
      admin.from("provider_spend").select("provider, spend_date").order("spend_date", { ascending: false }).limit(1),
    ]);
    const byModel: Record<string, { runs: number; failures: number; error_rate_pct: number; last_success: string | null }> = {};
    for (const j of jobs ?? []) {
      const m = j.model_used ?? "unknown";
      const t = (byModel[m] ??= { runs: 0, failures: 0, error_rate_pct: 0, last_success: null });
      t.runs += 1;
      if (j.status === "failed") t.failures += 1;
      else if (!t.last_success && j.status === "completed") t.last_success = j.created_at;
    }
    for (const t of Object.values(byModel)) t.error_rate_pct = Math.round((t.failures / Math.max(t.runs, 1)) * 100);
    const degraded = Object.entries(byModel).filter(([, t]) => t.error_rate_pct >= 25 && t.runs >= 4).map(([m]) => m);
    return {
      data: {
        window: "last 3 days (UTC)",
        per_model: byModel,
        degraded_models: degraded,
        router_config: (router ?? []).map((r) => ({ task: r.task_type, model: r.primary_model, active: r.is_active, circuit_breaker_pct: r.circuit_breaker_threshold_pct })),
        dataforseo_last_spend_date: spend?.[0]?.spend_date ?? null,
      },
      dataUpdatedAt: nowIso(),
      sources: [{ service: "agent_job_logs + model_router_config + provider_spend", dateRange: "last 3 days", updatedAt: nowIso() }],
    };
  },
};

export const providerHealthTools: HqTool[] = [providerHealth];
