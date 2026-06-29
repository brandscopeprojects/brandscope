import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// API Management data layer (Internal admin, Screen 26, /brandscope-admin/api-management).
// Sources (both Class-2, service-role-only, GLOBAL — rls-policies.md):
//   - api_health_logs   → latest health row per external provider
//   - model_router_config → task → model routing rules + circuit-breaker thresholds
// Read via the service-role admin client AFTER the layout's requireInternalAdmin gate.
//
// NOTE: there is NO api_cost_logs / cost_logs table in this schema. Cost analytics is
// deliberately OMITTED here rather than fabricated (CLAUDE.md: no fake data).

/** Latest health snapshot for one external provider (api_health_logs row, mapped). */
export type ApiHealthView = {
  id: string;
  /** Provider name, e.g. "DataForSEO", "Claude", "OpenAI". */
  provider: string;
  /** Raw status string from the row (e.g. "healthy" / "degraded" / "down"). */
  status: string;
  tone: "good" | "warn" | "bad" | "neutral";
  statusLabel: string;
  latencyMs: number | null;
  errorRate24h: number | null;
  creditBalance: number | null;
  creditCurrency: string | null;
  errorMessage: string | null;
  checkedAt: string | null;
  /** Derived circuit-breaker state from status + error rate. */
  circuit: CircuitState;
};

/** One model-routing rule (model_router_config row, mapped). */
export type RouterRuleView = {
  id: string;
  taskType: string;
  primaryModel: string;
  fallbackModel: string | null;
  isActive: boolean;
  circuitBreakerThresholdPct: number | null;
  maxTokens: number | null;
  requestsPerMin: number | null;
};

export type CircuitState = "closed" | "half-open" | "open";

export type InternalApiData = {
  health: ApiHealthView[];
  routerRules: RouterRuleView[];
};

/** Map a raw provider status string to a StatusPill tone + a clean label. */
function statusTone(status: string): { tone: ApiHealthView["tone"]; label: string } {
  const s = status.trim().toLowerCase();
  if (["healthy", "ok", "up", "operational", "online"].includes(s)) {
    return { tone: "good", label: "Healthy" };
  }
  if (["degraded", "warning", "warn", "slow", "partial"].includes(s)) {
    return { tone: "warn", label: "Degraded" };
  }
  if (["down", "critical", "failed", "error", "offline", "outage"].includes(s)) {
    return { tone: "bad", label: "Critical" };
  }
  // Unknown status → show verbatim, neutral.
  return { tone: "neutral", label: status };
}

/** Derive a circuit-breaker state from status + 24h error rate.
 *  open      → provider is down / critical.
 *  half-open → degraded, or error rate is elevated but not failing.
 *  closed    → healthy, traffic flows normally. */
function circuitState(tone: ApiHealthView["tone"], errorRate24h: number | null): CircuitState {
  if (tone === "bad") return "open";
  if (tone === "warn") return "half-open";
  if (errorRate24h != null && errorRate24h >= 25) return "open";
  if (errorRate24h != null && errorRate24h >= 5) return "half-open";
  return "closed";
}

/**
 * Latest api_health_logs row per provider + all model_router_config rules.
 * Both arrays may be empty (pre-telemetry) — the page renders an empty state then.
 */
export async function getInternalApiData(): Promise<InternalApiData> {
  const admin = createAdminClient();

  const [healthRes, routerRes] = await Promise.all([
    admin
      .from("api_health_logs")
      .select(
        "id, api_name, status, latency_ms, error_rate_24h, credit_balance, credit_currency, error_message, checked_at",
      )
      // Newest first so the first row seen per provider is the latest snapshot.
      .order("checked_at", { ascending: false, nullsFirst: false }),
    admin
      .from("model_router_config")
      .select(
        "id, task_type, primary_model, fallback_model, is_active, circuit_breaker_threshold_pct, max_tokens, requests_per_min",
      )
      .order("task_type", { ascending: true }),
  ]);

  // Collapse to the latest row per provider (rows already ordered newest-first).
  const seen = new Set<string>();
  const health: ApiHealthView[] = (healthRes.data ?? [])
    .filter((r) => {
      if (seen.has(r.api_name)) return false;
      seen.add(r.api_name);
      return true;
    })
    .map((r): ApiHealthView => {
      const { tone, label } = statusTone(r.status);
      return {
        id: r.id,
        provider: r.api_name,
        status: r.status,
        tone,
        statusLabel: label,
        latencyMs: r.latency_ms,
        errorRate24h: r.error_rate_24h,
        creditBalance: r.credit_balance,
        creditCurrency: r.credit_currency,
        errorMessage: r.error_message,
        checkedAt: r.checked_at,
        circuit: circuitState(tone, r.error_rate_24h),
      };
    })
    .sort((a, b) => a.provider.localeCompare(b.provider));

  const routerRules: RouterRuleView[] = (routerRes.data ?? []).map(
    (r): RouterRuleView => ({
      id: r.id,
      taskType: r.task_type,
      primaryModel: r.primary_model,
      fallbackModel: r.fallback_model,
      isActive: r.is_active ?? false,
      circuitBreakerThresholdPct: r.circuit_breaker_threshold_pct,
      maxTokens: r.max_tokens,
      requestsPerMin: r.requests_per_min,
    }),
  );

  return { health, routerRules };
}
