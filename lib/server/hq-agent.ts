import "server-only";

// HQ Agent — the internal ops copilot's tool layer (owner-approved 2026-07,
// feature-health-registry #329 "Internal Admin GPT Chat", built as a v2
// TOOL-CALLING agent per owner decision). Every tool is a READ-ONLY,
// service-role query over Class-2 internal tables; the route gates on
// internal_admin/super_admin BEFORE any tool can run. Tools return compact
// JSON the model must cite from — it never invents numbers.
//
// Areas WITHOUT a data source yet (marketing initiatives, CRM/support, CMS)
// are declared in the system prompt as "module not built" — the agent says so
// honestly instead of guessing. New modules = new tools here.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

type Admin = SupabaseClient<Database>;
type Json = Record<string, unknown>;

export type HqTool = {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  run: (admin: Admin) => Promise<Json>;
};

const kobo = (v: number | null | undefined) => Math.round((v ?? 0) / 100);

/** Group ISO timestamps into YYYY-MM-DD week (Monday) buckets. */
function weekOf(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return out;
}

export const HQ_TOOLS: HqTool[] = [
  {
    name: "brands_overview",
    description:
      "Registered brands: total count, newest 20 (name, domain, markets, plan, signup date), signups per week. Use for 'how many brands registered', growth questions.",
    input_schema: { type: "object", properties: {} },
    run: async (admin) => {
      const { data: brands } = await admin
        .from("brands")
        .select("name, domain, market, organisation_id, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      const { data: subs } = await admin
        .from("subscriptions")
        .select("organisation_id, plan, status, mrr_kobo");
      const subByOrg = new Map((subs ?? []).map((s) => [s.organisation_id, s]));
      const rows = brands ?? [];
      return {
        total_brands: rows.length,
        signups_by_week: countBy(rows, (b) => weekOf(b.created_at as string)),
        latest: rows.slice(0, 20).map((b) => ({
          name: b.name,
          domain: b.domain,
          markets: b.market,
          created_at: b.created_at,
          plan: subByOrg.get(b.organisation_id)?.plan ?? "free",
          subscription_status: subByOrg.get(b.organisation_id)?.status ?? null,
        })),
      };
    },
  },
  {
    name: "revenue_pnl",
    description:
      "P&L view: MRR by plan, payment history (90d), weekly revenue_metrics (incl. infra/api cost + gross margin when recorded), churn events, and metered LLM spend (USD, 30d) by task. Use for revenue, P&L, MRR, churn, cost questions.",
    input_schema: { type: "object", properties: {} },
    run: async (admin) => {
      const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
      const since90 = new Date(Date.now() - 90 * 864e5).toISOString();
      const [{ data: subs }, { data: pays }, { data: weeks }, { data: churn }, { data: jobs }] =
        await Promise.all([
          admin.from("subscriptions").select("plan, status, mrr_kobo"),
          admin
            .from("payment_history")
            .select("amount_kobo, currency, status, paid_at, created_at")
            .gte("created_at", since90)
            .limit(500),
          admin
            .from("revenue_metrics")
            .select(
              "period_week, mrr_kobo, active_brands, new_brands, churned_brands, revenue_kobo, infra_cost_kobo, api_cost_kobo, gross_margin_pct",
            )
            .order("period_week", { ascending: false })
            .limit(12),
          admin
            .from("churn_events")
            .select("event_type, mrr_delta_kobo, from_plan, to_plan, reason, occurred_at")
            .order("occurred_at", { ascending: false })
            .limit(20),
          admin
            .from("agent_job_logs")
            .select("task_type, cost_usd, created_at")
            .gte("created_at", since30)
            .limit(2000),
        ]);

      const mrrByPlan: Record<string, number> = {};
      for (const s of subs ?? []) {
        if (s.status === "active" || s.status === "trialing") {
          mrrByPlan[s.plan] = (mrrByPlan[s.plan] ?? 0) + kobo(s.mrr_kobo);
        }
      }
      const llmByTask: Record<string, number> = {};
      let llmTotal = 0;
      for (const j of jobs ?? []) {
        const c = Number(j.cost_usd ?? 0);
        llmByTask[j.task_type ?? "unknown"] =
          Number(((llmByTask[j.task_type ?? "unknown"] ?? 0) + c).toFixed(4));
        llmTotal += c;
      }
      const paid = (pays ?? []).filter((p) => p.status === "paid");
      return {
        note: "kobo converted to NGN (naira); LLM spend is USD. DataForSEO/provider costs are not metered yet (metering pipeline pending) — P&L cost side is LLM-only unless revenue_metrics rows record infra/api cost.",
        mrr_ngn_by_plan: mrrByPlan,
        subscriptions_by_status: countBy(subs ?? [], (s) => s.status ?? "unknown"),
        payments_90d: {
          paid_count: paid.length,
          paid_total_ngn: paid.reduce((a, p) => a + kobo(p.amount_kobo), 0),
          by_status: countBy(pays ?? [], (p) => p.status),
        },
        weekly_revenue_metrics: weeks ?? [],
        recent_churn_events: churn ?? [],
        llm_spend_usd_30d: { total: Number(llmTotal.toFixed(2)), by_task: llmByTask },
      };
    },
  },
  {
    name: "operations_status",
    description:
      "Scan pipeline operations: recent scan jobs + status counts, dead-letter queue depth, last cron runs, recent feature-health failures. Use for 'are scans running', reliability and incident questions.",
    input_schema: { type: "object", properties: {} },
    run: async (admin) => {
      const [{ data: scans }, { count: dlq }, { data: crons }, { data: health }] =
        await Promise.all([
          admin
            .from("scan_jobs")
            .select("brand_id, status, scan_week, progress_percentage, error_message, created_at")
            .order("created_at", { ascending: false })
            .limit(50),
          admin
            .from("dead_letter_queue")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          admin
            .from("cron_job_logs")
            .select("job_name, status, started_at, duration_seconds, error_message")
            .order("started_at", { ascending: false })
            .limit(10),
          admin
            .from("feature_health_logs")
            .select("feature_name, status, root_cause, created_at")
            .in("status", ["failed", "partial"])
            .order("created_at", { ascending: false })
            .limit(20),
        ]);
      return {
        scan_jobs_by_status: countBy(scans ?? [], (s) => s.status ?? "unknown"),
        recent_scans: (scans ?? []).slice(0, 10),
        dead_letter_pending: dlq ?? 0,
        recent_cron_runs: crons ?? [],
        recent_feature_failures: health ?? [],
      };
    },
  },
  {
    name: "agent_performance",
    description:
      "AI agent telemetry (last 500 runs): per task — run count, failure rate, avg duration, cost; plus the 10 most recent errors. Use for 'are the agents healthy', quality and cost-per-task questions.",
    input_schema: { type: "object", properties: {} },
    run: async (admin) => {
      const { data: jobs } = await admin
        .from("agent_job_logs")
        .select("task_type, status, duration_ms, cost_usd, error_message, model_used, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      const byTask: Record<
        string,
        { runs: number; failures: number; avg_ms: number; cost_usd: number }
      > = {};
      for (const j of jobs ?? []) {
        const t = (byTask[j.task_type ?? "unknown"] ??= {
          runs: 0,
          failures: 0,
          avg_ms: 0,
          cost_usd: 0,
        });
        t.runs += 1;
        if (j.status === "failed") t.failures += 1;
        t.avg_ms += Number(j.duration_ms ?? 0);
        t.cost_usd = Number((t.cost_usd + Number(j.cost_usd ?? 0)).toFixed(4));
      }
      for (const t of Object.values(byTask)) t.avg_ms = Math.round(t.avg_ms / Math.max(t.runs, 1));
      return {
        by_task: byTask,
        recent_errors: (jobs ?? [])
          .filter((j) => j.status === "failed")
          .slice(0, 10)
          .map((j) => ({
            task: j.task_type,
            model: j.model_used,
            error: j.error_message,
            at: j.created_at,
          })),
      };
    },
  },
  {
    name: "user_growth",
    description:
      "Users & access: profile count by role, signups per week, active sessions, failed logins (7d). Use for user growth and security-signal questions.",
    input_schema: { type: "object", properties: {} },
    run: async (admin) => {
      const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
      const [{ data: profiles }, { count: sessions }, { count: fails }] = await Promise.all([
        admin.from("profiles").select("role, created_at").limit(1000),
        admin.from("active_sessions").select("id", { count: "exact", head: true }),
        admin
          .from("failed_logins")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since7),
      ]);
      return {
        total_users: (profiles ?? []).length,
        by_role: countBy(profiles ?? [], (p) => p.role ?? "unknown"),
        signups_by_week: countBy(profiles ?? [], (p) => weekOf(p.created_at as string)),
        active_sessions: sessions ?? 0,
        failed_logins_7d: fails ?? 0,
      };
    },
  },
];

export const HQ_SYSTEM_PROMPT = [
  "You are the Brandscope HQ Agent — the founder's internal operations copilot inside the",
  "Internal Operations Console. You answer management questions about the Brandscope",
  "business itself (NOT about any customer brand's competitive data).",
  "",
  "Rules:",
  "- ALWAYS ground numbers in tool results. Call the relevant tool(s) first; never guess",
  "  or invent figures. Cite the figure plainly (e.g. '3 brands registered this week').",
  "- Money: *_kobo fields arrive pre-converted to NGN in tool output; LLM spend is USD.",
  "  Say the currency every time.",
  "- If data is empty or a pipeline hasn't run yet, say so plainly and what unblocks it.",
  "- Modules that DO NOT EXIST yet (no data source): marketing-initiatives tracking,",
  "  customer-support/CRM inbox, and content management (CMS). If asked about these,",
  "  state honestly that the module isn't built yet and is on the internal roadmap —",
  "  do not fabricate. Everything else you can answer via tools.",
  "- Be concise and decisive: lead with the answer, then the supporting numbers, then",
  "  (only when useful) one recommended action.",
  "- Stay on Brandscope operations. Politely decline unrelated topics.",
].join("\n");
