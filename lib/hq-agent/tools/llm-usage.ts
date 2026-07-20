import "server-only";

import type { HqTool } from "../types";
import { PERIOD_PARAM, validatePeriodArg, resolvePeriod, nowIso } from "./shared";

/** Infer provider from a model id (best-effort labelling, not billing truth). */
function providerOf(model: string | null): string {
  const m = (model ?? "").toLowerCase();
  if (m.includes("claude")) return "anthropic";
  if (m.includes("gpt") || m.includes("o1") || m.includes("text-embedding") || m.includes("omni")) return "openai";
  if (m.includes("deepseek")) return "deepseek";
  if (m) return "other";
  return "unknown";
}

/** get_llm_usage_summary — LLM + provider spend by model/task, with comparison. */
const llmUsageSummary: HqTool = {
  name: "get_llm_usage_summary",
  category: "llm_usage",
  description:
    "AI usage & cost for a period: LLM spend (USD) and token usage by provider, model and task from agent_job_logs, plus DataForSEO provider spend, with a comparison to the previous equal period. Use for 'what did we spend on LLMs', cost-by-task, usage trends.",
  parameters: { type: "object", properties: { ...PERIOD_PARAM }, additionalProperties: false },
  validate: validatePeriodArg,
  run: async ({ admin }, args) => {
    const period = resolvePeriod(args.period);
    const prevSince = new Date(new Date(period.sinceIso).getTime() - period.days * 864e5).toISOString();
    const [{ data: jobs }, { data: prevJobs }, { data: spend }] = await Promise.all([
      admin.from("agent_job_logs").select("task_type, model_used, cost_usd, total_tokens, created_at").gte("created_at", period.sinceIso).limit(10000),
      admin.from("agent_job_logs").select("cost_usd, created_at").gte("created_at", prevSince).lt("created_at", period.sinceIso).limit(10000),
      admin.from("provider_spend").select("provider, cost_usd, task_type, spend_date").gte("spend_date", period.sinceIso.slice(0, 10)).limit(10000),
    ]);
    const byTask: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    let llmTotal = 0;
    let tokens = 0;
    for (const j of jobs ?? []) {
      const c = Number(j.cost_usd ?? 0);
      llmTotal += c;
      tokens += Number(j.total_tokens ?? 0);
      byTask[j.task_type ?? "unknown"] = Number(((byTask[j.task_type ?? "unknown"] ?? 0) + c).toFixed(4));
      byModel[j.model_used ?? "unknown"] = Number(((byModel[j.model_used ?? "unknown"] ?? 0) + c).toFixed(4));
      const p = providerOf(j.model_used);
      byProvider[p] = Number(((byProvider[p] ?? 0) + c).toFixed(4));
    }
    const prevTotal = (prevJobs ?? []).reduce((a, j) => a + Number(j.cost_usd ?? 0), 0);
    const dfsTotal = (spend ?? []).reduce((a, s) => a + Number(s.cost_usd ?? 0), 0);
    return {
      data: {
        window: period.label,
        llm_spend_usd: Number(llmTotal.toFixed(2)),
        llm_tokens: tokens,
        by_provider_usd: byProvider,
        by_model_usd: byModel,
        by_task_usd: byTask,
        dataforseo_spend_usd: Number(dfsTotal.toFixed(2)),
        previous_period_llm_usd: Number(prevTotal.toFixed(2)),
        change_vs_previous_usd: Number((llmTotal - prevTotal).toFixed(2)),
      },
      dataUpdatedAt: nowIso(),
      sources: [{ service: "agent_job_logs + provider_spend", dateRange: period.label, updatedAt: nowIso() }],
    };
  },
};

export const llmUsageTools: HqTool[] = [llmUsageSummary];
