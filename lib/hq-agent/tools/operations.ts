import "server-only";

import type { HqTool, HqToolContext } from "../types";
import { countBy, kobo, nowIso } from "./shared";

/** get_scan_operations_status — pipeline health. */
const scanOperationsStatus: HqTool = {
  name: "get_scan_operations_status",
  category: "operations",
  description:
    "Scan pipeline operations: scan-job status counts, active/pending/failed jobs, the oldest queued job, dead-letter queue depth, recent cron runs, and recent feature-health failures. Use for 'are scans running', stalls, incidents.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  validate: () => ({}),
  run: async ({ admin }) => {
    const [{ data: scans }, { count: dlq }, { data: crons }, { data: health }] = await Promise.all([
      admin.from("scan_jobs").select("brand_id, status, scan_week, progress_percentage, error_message, created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("dead_letter_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("cron_job_logs").select("job_name, status, started_at, duration_seconds, error_message").order("started_at", { ascending: false }).limit(10),
      admin.from("feature_health_logs").select("feature_name, feature_category, status, root_cause, created_at").in("status", ["failed", "partial"]).order("created_at", { ascending: false }).limit(20),
    ]);
    const rows = scans ?? [];
    const pending = rows.filter((s) => s.status === "queued" || s.status === "running");
    const oldestQueued = pending.length ? pending[pending.length - 1] : null;
    return {
      data: {
        scan_jobs_by_status: countBy(rows, (s) => s.status ?? "unknown"),
        active_or_pending: pending.length,
        oldest_pending_job: oldestQueued ? { status: oldestQueued.status, created_at: oldestQueued.created_at, progress: oldestQueued.progress_percentage } : null,
        recent_scans: rows.slice(0, 10),
        dead_letter_pending: dlq ?? 0,
        recent_cron_runs: crons ?? [],
        recent_feature_failures: health ?? [],
      },
      dataUpdatedAt: rows[0]?.created_at ?? nowIso(),
      sources: [{ service: "scan_jobs + dead_letter_queue + cron_job_logs + feature_health_logs", updatedAt: rows[0]?.created_at ?? null }],
    };
  },
};

/** get_recent_critical_alerts — normalised operational alerts from real signals. */
const recentCriticalAlerts: HqTool = {
  name: "get_recent_critical_alerts",
  category: "operations",
  description:
    "Recent items requiring management attention, normalised from real operational signals: feature-health failures, dead-letter-queue entries, and failed scan jobs. Each has severity, category, first-seen, state and the related entity. Use for 'what needs attention today'.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  validate: () => ({}),
  run: async ({ admin }) => {
    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const [{ data: health }, { data: dlq }, { data: failedScans }] = await Promise.all([
      admin.from("feature_health_logs").select("feature_name, feature_category, status, root_cause, created_at").in("status", ["failed", "partial"]).gte("created_at", since).order("created_at", { ascending: false }).limit(25),
      admin.from("dead_letter_queue").select("task_type, failure_reason, last_error, status, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(25),
      admin.from("scan_jobs").select("brand_id, status, error_message, created_at").eq("status", "failed").gte("created_at", since).order("created_at", { ascending: false }).limit(25),
    ]);
    const alerts = [
      ...(health ?? []).map((h) => ({ severity: h.status === "failed" ? "high" : "medium", category: `feature:${h.feature_category ?? "unknown"}`, summary: `${h.feature_name}: ${h.root_cause ?? h.status}`, first_seen: h.created_at, state: h.status })),
      ...(dlq ?? []).map((d) => ({ severity: "high", category: `dead_letter:${d.task_type ?? "unknown"}`, summary: d.failure_reason ?? d.last_error ?? "dead-letter entry", first_seen: d.created_at, state: d.status })),
      ...(failedScans ?? []).map((s) => ({ severity: "high", category: "scan", summary: s.error_message ?? "scan job failed", first_seen: s.created_at, state: "failed", entity: s.brand_id })),
    ].sort((a, b) => new Date(b.first_seen ?? 0).getTime() - new Date(a.first_seen ?? 0).getTime());
    return {
      data: { window: "last 7 days (UTC)", alert_count: alerts.length, alerts: alerts.slice(0, 30) },
      dataUpdatedAt: nowIso(),
      sources: [{ service: "feature_health_logs + dead_letter_queue + scan_jobs", dateRange: "last 7 days", updatedAt: nowIso() }],
    };
  },
};

/** get_management_briefing — cross-cutting KPI snapshot + attention items. */
const managementBriefing: HqTool = {
  name: "get_management_briefing",
  category: "operations",
  description:
    "Cross-cutting management briefing: new brands (7d), MRR + active subscriptions, scan-pipeline status, dead-letter depth, LLM spend (30d), and the top attention items. Use for 'today's briefing', 'what needs attention', general status.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  validate: () => ({}),
  run: async ({ admin }: HqToolContext) => {
    const since7 = new Date(Date.now() - 7 * 864e5).toISOString();
    const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
    const [{ count: newBrands }, { data: subs }, { data: scans }, { count: dlq }, { data: jobs }, { data: health }] = await Promise.all([
      admin.from("brands").select("id", { count: "exact", head: true }).gte("created_at", since7),
      admin.from("subscriptions").select("plan, status, mrr_kobo"),
      admin.from("scan_jobs").select("status, created_at").order("created_at", { ascending: false }).limit(100),
      admin.from("dead_letter_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("agent_job_logs").select("task_type, cost_usd").gte("created_at", since30).limit(5000),
      admin.from("feature_health_logs").select("feature_name, status, created_at").in("status", ["failed", "partial"]).gte("created_at", since7).order("created_at", { ascending: false }).limit(5),
    ]);
    const active = (subs ?? []).filter((s) => s.status === "active" || s.status === "trialing");
    const llm = (jobs ?? []).reduce((a, j) => a + Number(j.cost_usd ?? 0), 0);
    return {
      data: {
        window: "7-day signups, 30-day spend (UTC)",
        new_brands_7d: newBrands ?? 0,
        mrr_ngn_total: active.reduce((a, s) => a + kobo(s.mrr_kobo), 0),
        active_subscriptions: (subs ?? []).filter((s) => s.status === "active").length,
        trials: (subs ?? []).filter((s) => s.status === "trialing").length,
        scans_by_status: countBy(scans ?? [], (s) => s.status ?? "unknown"),
        dead_letter_pending: dlq ?? 0,
        llm_spend_usd_30d: Number(llm.toFixed(2)),
        top_attention: (health ?? []).map((h) => `${h.feature_name} (${h.status})`),
      },
      dataUpdatedAt: nowIso(),
      sources: [{ service: "brands + subscriptions + scan_jobs + agent_job_logs + feature_health_logs", updatedAt: nowIso() }],
    };
  },
};

export const operationsTools: HqTool[] = [managementBriefing, scanOperationsStatus, recentCriticalAlerts];
