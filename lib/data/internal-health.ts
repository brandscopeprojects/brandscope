import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/data/demo-mode";
import type { StatusTone } from "@/components/intelligence/StatusPill";

/**
 * Internal-admin System Health data (Screen 24, /brandscope-admin/health).
 *
 * The four source tables — `system_health`, `feature_health_logs`,
 * `cron_job_logs`, `api_health_logs` — are ALL Class-2 (service-role-only) and
 * their data is GLOBAL, not brand-scoped. We therefore read them with the
 * ADMIN client (createAdminClient), which bypasses RLS. The internal-admin
 * layout has already verified the caller's internal-admin role, so no
 * additional scoping is applied here (the data is platform-wide by design).
 *
 * Every value returned is REAL — pulled straight from the tables. When a table
 * has no rows we return an empty array; the page renders an honest empty state
 * rather than fabricating metrics.
 */

// ── Status mapping helpers ───────────────────────────────────────────────────

/** Normalise an arbitrary status string to a StatusPill tone. */
function toneForStatus(status: string | null | undefined): StatusTone {
  switch ((status ?? "").toLowerCase()) {
    case "healthy":
    case "passed":
    case "ok":
    case "up":
    case "operational":
    case "success":
    case "completed":
    case "running":
      return "good";
    case "degraded":
    case "partial":
    case "warning":
    case "warn":
    case "slow":
      return "warn";
    case "critical":
    case "failed":
    case "down":
    case "error":
    case "outage":
      return "bad";
    case "not_applicable_mvp":
    case "n/a":
    case "pending":
    case "queued":
    case "unknown":
    default:
      return "neutral";
  }
}

/** Human label for a status pill. `not_applicable_mvp` collapses to "N/A". */
function labelForStatus(status: string | null | undefined): string {
  const raw = (status ?? "").toLowerCase();
  if (raw === "not_applicable_mvp" || raw === "n/a") return "N/A";
  if (!raw) return "Unknown";
  // Title-case, drop underscores.
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Timestamp / number formatting (server-side, evidence style) ──────────────

/** ISO timestamp → "23 Jun 2026, 14:05 UTC" (mono evidence value). Null-safe. */
function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${date}, ${time} UTC`;
}

/** Seconds → "1m 12s" / "4.30s" / "—". */
function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 0)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

/** Latency ms → "412 ms" / "—". */
function formatLatency(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  return `${Math.round(ms)} ms`;
}

/** A 0–1 (or 0–100) rate → "1.2%" / "—". Treats >1 as already a percentage. */
function formatRate(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "—";
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${pct.toFixed(pct < 10 ? 2 : 1)}%`;
}

// ── View models ──────────────────────────────────────────────────────────────

export type SystemStatusVM = {
  overallStatusLabel: string;
  overallStatusTone: StatusTone;
  /** Per-service snapshot tiles, real rows only. */
  services: { id: string; name: string; statusLabel: string; tone: StatusTone; detail: string | null; checkedAt: string }[];
  activeIncidents: number;
};

export type FeatureHealthVM = {
  id: string;
  feature: string;
  category: string;
  tier: string;
  statusLabel: string;
  tone: StatusTone;
  lastChecked: string;
  notes: string;
};

export type CronJobVM = {
  id: string;
  jobName: string;
  schedule: string;
  statusLabel: string;
  tone: StatusTone;
  lastRun: string;
  duration: string;
  notes: string;
};

export type ApiHealthVM = {
  id: string;
  provider: string;
  statusLabel: string;
  tone: StatusTone;
  latency: string;
  errorRate: string;
  lastChecked: string;
};

export type InternalHealthData = {
  systemStatus: SystemStatusVM | null;
  features: FeatureHealthVM[];
  cronJobs: CronJobVM[];
  apis: ApiHealthVM[];
};

const BAD_TONES: ReadonlySet<StatusTone> = new Set<StatusTone>(["bad"]);

// ── Fetcher ──────────────────────────────────────────────────────────────────

/**
 * Load the global System Health snapshot. Returns typed view models with empty
 * arrays where a table has no rows. Never throws on missing data; the page
 * decides between the empty state and the populated tables.
 */
export async function getInternalHealth(): Promise<InternalHealthData> {
  // Demo short-circuit: serve the RiversBet sample console instead of querying
  // Supabase (paired with the public /preview/internal-health route).
  if (isDemoMode()) {
    const { DEMO_INTERNAL_HEALTH } = await import("@/lib/data/demo/internal-health");
    return DEMO_INTERNAL_HEALTH;
  }

  const supabase = createAdminClient();

  const [systemRes, featureRes, cronRes, apiRes] = await Promise.all([
    // Latest snapshot per service: order newest first, dedupe in code.
    supabase
      .from("system_health")
      .select("id, service_name, status, detail, checked_at, created_at")
      .order("checked_at", { ascending: false, nullsFirst: false })
      .limit(100),
    // Recent per-feature health, newest first.
    supabase
      .from("feature_health_logs")
      .select(
        "id, feature_name, feature_category, feature_tier, status, root_cause, resolution_suggested, scan_week, created_at",
      )
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(60),
    // Recent cron runs, latest first.
    supabase
      .from("cron_job_logs")
      .select(
        "id, job_name, schedule, status, duration_seconds, error_message, started_at, completed_at, created_at",
      )
      .order("started_at", { ascending: false, nullsFirst: false })
      .limit(20),
    // Recent per-provider API health, latest first.
    supabase
      .from("api_health_logs")
      .select(
        "id, api_name, status, latency_ms, error_rate_24h, error_message, checked_at",
      )
      .order("checked_at", { ascending: false, nullsFirst: false })
      .limit(20),
  ]);

  // ── system_health → one latest tile per service ──
  const systemRows = systemRes.data ?? [];
  const latestByService = new Map<string, (typeof systemRows)[number]>();
  for (const row of systemRows) {
    if (!latestByService.has(row.service_name)) latestByService.set(row.service_name, row);
  }
  const services = Array.from(latestByService.values()).map((row) => ({
    id: row.id,
    name: row.service_name,
    statusLabel: labelForStatus(row.status),
    tone: toneForStatus(row.status),
    detail: row.detail,
    checkedAt: formatTimestamp(row.checked_at),
  }));

  let systemStatus: SystemStatusVM | null = null;
  if (services.length > 0) {
    const activeIncidents = services.filter((s) => BAD_TONES.has(s.tone)).length;
    const degraded = services.filter((s) => s.tone === "warn").length;
    const overallTone: StatusTone =
      activeIncidents > 0 ? "bad" : degraded > 0 ? "warn" : "good";
    const overallLabel =
      overallTone === "bad" ? "Critical" : overallTone === "warn" ? "Degraded" : "Healthy";
    systemStatus = {
      overallStatusLabel: overallLabel,
      overallStatusTone: overallTone,
      services,
      activeIncidents,
    };
  }

  // ── feature_health_logs → recent, dedupe to latest per feature ──
  const featureRows = featureRes.data ?? [];
  const latestByFeature = new Map<string, (typeof featureRows)[number]>();
  for (const row of featureRows) {
    if (!latestByFeature.has(row.feature_name)) latestByFeature.set(row.feature_name, row);
  }
  const features: FeatureHealthVM[] = Array.from(latestByFeature.values()).map((row) => ({
    id: row.id,
    feature: row.feature_name,
    category: row.feature_category,
    tier: row.feature_tier,
    statusLabel: labelForStatus(row.status),
    tone: toneForStatus(row.status),
    lastChecked: formatTimestamp(row.created_at),
    notes: row.root_cause ?? row.resolution_suggested ?? "—",
  }));

  // ── cron_job_logs → recent runs ──
  const cronJobs: CronJobVM[] = (cronRes.data ?? []).map((row) => ({
    id: row.id,
    jobName: row.job_name,
    schedule: row.schedule,
    statusLabel: labelForStatus(row.status),
    tone: toneForStatus(row.status),
    lastRun: formatTimestamp(row.started_at ?? row.completed_at ?? row.created_at),
    duration: formatDuration(row.duration_seconds),
    notes: row.error_message ?? "—",
  }));

  // ── api_health_logs → recent per provider ──
  const apis: ApiHealthVM[] = (apiRes.data ?? []).map((row) => ({
    id: row.id,
    provider: row.api_name,
    statusLabel: labelForStatus(row.status),
    tone: toneForStatus(row.status),
    latency: formatLatency(row.latency_ms),
    errorRate: formatRate(row.error_rate_24h),
    lastChecked: formatTimestamp(row.checked_at),
  }));

  return { systemStatus, features, cronJobs, apis };
}
