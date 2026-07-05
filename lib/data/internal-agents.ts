import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/data/demo-mode";
import type { Database } from "@/types/database.types";
import type { StatusTone } from "@/components/intelligence/StatusPill";

// ── Evidence-style formatters (mono cells) ───────────────────────────────────
// Server-side, deterministic (UTC) so SSR and any re-render agree. Exported for
// the Agents* components, which render these strings in font-mono.

/** ISO timestamp → "23 Jun 2026, 14:05 UTC". Null-safe. */
export function formatTraceTime(iso: string | null | undefined): string {
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

/** Latency ms → "412 ms" / "1,204 ms" / "—". */
export function formatLatencyMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  return `${Math.round(ms).toLocaleString("en-GB")} ms`;
}

/** Token count → "12,480" / "—". */
export function formatTokens(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-GB");
}

/** USD cost → "$0.0123" / "$1.40" / "—". Small amounts keep 4 dp. */
export function formatCostUsd(usd: number | null | undefined): string {
  if (usd == null || Number.isNaN(usd)) return "—";
  const dp = usd !== 0 && Math.abs(usd) < 0.1 ? 4 : 2;
  return `$${usd.toFixed(dp)}`;
}

// Internal Agent Control Centre data (Screen 25, /brandscope-admin/agents).
//
// `agents`, `agent_skills`, `agent_job_logs`, `prompt_versions` are all Class-2
// (service-role-only, GLOBAL — no brand scope). They are read ONLY through the
// service-role admin client, AFTER the layout's requireInternalAdmin() role gate
// (rls-policies.md §"Class 2"). These are the agent fleet, their skills, the
// active prompt per agent, and the recent LLM-call traces (agent_job_logs).

type AgentRow = Database["public"]["Tables"]["agents"]["Row"];
type AgentSkillRow = Database["public"]["Tables"]["agent_skills"]["Row"];
type JobLogRow = Database["public"]["Tables"]["agent_job_logs"]["Row"];
type PromptVersionRow = Database["public"]["Tables"]["prompt_versions"]["Row"];

/** How many job-trace rows we surface (most recent first). */
export const JOB_TRACE_LIMIT = 30;

export type AgentSkillView = {
  id: string;
  name: string;
  isActive: boolean;
};

// Declared config projected from function source by
// scripts/generate-agent-manifest.mjs (backlog P2c Phase A item 1). Code is the
// single source of truth; the manifest cannot drift from it.
import agentManifest from "./agent-manifest.json";

export type RouterRuleView = {
  task: string;
  primaryModel: string;
  fallbackModel: string | null;
  temperature: number | null;
  maxTokens: number | null;
};

export type AgentConfigView = {
  declared: {
    promptVersions: string[];
    temperatures: number[];
    maxTokens: number[];
    providers: string[];
    dataforseoEndpoints: string[];
    moduleBudgetMs: number | null;
    retryDelaysMs: number[] | null;
    schedule: string | null;
    routerRules: RouterRuleView[];
    gating: { column: string; disabledBrands: number }[];
    functions: string[];
    manifestGeneratedAt: string;
  };
  observed: {
    runs: number;
    failures: number;
    avgDurationMs: number | null;
    avgCostUsd: number | null;
    lastModel: string | null;
    lastPromptVersion: string | null;
    lastRunAt: string | null;
  } | null;
  drift: string[];
};

export type AgentView = {
  id: string;
  name: string; // machine name (mono)
  displayName: string;
  description: string | null;
  model: string;
  status: string; // raw status label
  statusTone: StatusTone;
  currentVersion: string | null;
  skills: AgentSkillView[];
  /** researcher only: module tasks paused via the kill switch (agents.config). */
  disabledModules?: string[];
  /** Declared vs Observed configuration (null in demo mode). */
  config?: AgentConfigView | null;
};

export type PromptVersionView = {
  id: string;
  agentName: string;
  version: string;
  status: string | null;
  updatedAt: string | null; // ISO; mono-formatted in the view
};

export type JobTraceView = {
  id: string;
  agentName: string;
  model: string | null;
  totalTokens: number | null;
  costUsd: number | null;
  durationMs: number | null;
  status: string;
  statusTone: StatusTone;
  createdAt: string | null; // ISO
};

export type AgentControlData = {
  agents: AgentView[];
  promptVersions: PromptVersionView[];
  jobTrace: JobTraceView[];
  /** True when more job logs exist than the surfaced trace cap. */
  jobTraceTruncated: boolean;
};

/** Map an agent's lifecycle status → a StatusPill tone. */
function agentStatusTone(status: string): StatusTone {
  switch (status.toLowerCase()) {
    case "active":
    case "running":
    case "healthy":
      return "good";
    case "paused":
    case "idle":
    case "draft":
      return "neutral";
    case "error":
    case "failed":
    case "disabled":
      return "bad";
    default:
      return "neutral";
  }
}

/** Map an agent_job_logs.status ('passed'|'failed'|'retried') → a StatusPill tone. */
function jobStatusTone(status: string): StatusTone {
  switch (status.toLowerCase()) {
    case "passed":
    case "success":
    case "completed":
      return "good";
    case "retried":
    case "partial":
      return "warn";
    case "failed":
    case "error":
      return "bad";
    default:
      return "neutral";
  }
}

/**
 * Load the full Agent Control Centre payload — global, no brand scope.
 *
 * Wrapped in React cache() so a re-render in the same request reuses the query.
 * Service-role client: the layout already enforced internal_admin/super_admin.
 */
export const getAgentControlData = cache(
  async function getAgentControlData(): Promise<AgentControlData> {
    if (isDemoMode()) {
      const { DEMO_INTERNAL_AGENTS } = await import(
        "@/lib/data/demo/internal-agents"
      );
      return DEMO_INTERNAL_AGENTS;
    }

    const supabase = createAdminClient();

    const [
      { data: agents },
      { data: skills },
      { data: logs },
      { data: prompts },
      { data: routerRows },
      { data: observedLogs },
      { data: prefRows },
    ] = await Promise.all([
      supabase
        .from("agents")
        .select(
          "id, name, display_name, description, model, status, current_version, config",
        )
        .order("display_name", { ascending: true }),
      supabase
        .from("agent_skills")
        .select("id, agent_id, name, is_active")
        .order("name", { ascending: true }),
      supabase
        .from("agent_job_logs")
        .select(
          "id, agent_name, model_used, total_tokens, cost_usd, duration_ms, status, created_at",
        )
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(JOB_TRACE_LIMIT + 1),
      supabase
        .from("prompt_versions")
        .select("id, agent_name, version, status, deployed_at, created_at")
        .order("deployed_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("model_router_config")
        .select("task_type, primary_model, fallback_model, temperature, max_tokens")
        .eq("is_active", true),
      supabase
        .from("agent_job_logs")
        .select("agent_name, model_used, prompt_version, duration_ms, cost_usd, status, created_at")
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(500),
      supabase
        .from("brand_preferences")
        .select(
          "traffic_seo_enabled, geo_aeo_enabled, social_ads_enabled, product_intel_enabled, customer_intel_enabled, regulatory_enabled, promotions_enabled, hiring_signals_enabled",
        )
        .limit(1000),
    ]);

    const configByAgent = buildAgentConfigs(
      routerRows ?? [],
      (observedLogs ?? []) as ObservedLogRow[],
      (prefRows ?? []) as Record<string, boolean | null>[],
    );

    const skillsByAgent = new Map<string, AgentSkillView[]>();
    for (const s of (skills ?? []) as Pick<
      AgentSkillRow,
      "id" | "agent_id" | "name" | "is_active"
    >[]) {
      const list = skillsByAgent.get(s.agent_id) ?? [];
      list.push({ id: s.id, name: s.name, isActive: s.is_active ?? true });
      skillsByAgent.set(s.agent_id, list);
    }

    const agentViews: AgentView[] = (
      (agents ?? []) as Pick<
        AgentRow,
        | "id"
        | "name"
        | "display_name"
        | "description"
        | "model"
        | "status"
        | "current_version"
        | "config"
      >[]
    ).map((a) => ({
      id: a.id,
      name: a.name,
      displayName: a.display_name,
      description: a.description,
      model: a.model,
      status: a.status,
      statusTone: agentStatusTone(a.status),
      currentVersion: a.current_version,
      skills: skillsByAgent.get(a.id) ?? [],
      disabledModules: (() => {
        const cfg = (a as { config?: unknown }).config as { disabled_modules?: unknown } | null;
        return Array.isArray(cfg?.disabled_modules) ? cfg.disabled_modules.map(String) : [];
      })(),
      config: configByAgent.get(a.name) ?? null,
    }));

    // Active prompt per agent. prompt_versions has no FK to agents; we key on
    // agent_name. Prefer the row marked active/deployed; the query is already
    // ordered by deployed_at desc so the first per agent is the current one.
    const promptByAgent = new Map<string, PromptVersionView>();
    for (const p of (prompts ?? []) as Pick<
      PromptVersionRow,
      "id" | "agent_name" | "version" | "status" | "deployed_at" | "created_at"
    >[]) {
      const existing = promptByAgent.get(p.agent_name);
      const isActive = (p.status ?? "").toLowerCase() === "active";
      // First row wins (latest deployed). Upgrade to an explicitly-active row.
      if (!existing || (isActive && existing.status?.toLowerCase() !== "active")) {
        promptByAgent.set(p.agent_name, {
          id: p.id,
          agentName: p.agent_name,
          version: p.version,
          status: p.status,
          updatedAt: p.deployed_at ?? p.created_at,
        });
      }
    }
    const promptVersions = Array.from(promptByAgent.values()).sort((a, b) =>
      a.agentName.localeCompare(b.agentName),
    );

    const logRows = (logs ?? []) as Pick<
      JobLogRow,
      | "id"
      | "agent_name"
      | "model_used"
      | "total_tokens"
      | "cost_usd"
      | "duration_ms"
      | "status"
      | "created_at"
    >[];
    const jobTraceTruncated = logRows.length > JOB_TRACE_LIMIT;
    const jobTrace: JobTraceView[] = logRows
      .slice(0, JOB_TRACE_LIMIT)
      .map((l) => ({
        id: l.id,
        agentName: l.agent_name,
        model: l.model_used,
        totalTokens: l.total_tokens,
        costUsd: l.cost_usd,
        durationMs: l.duration_ms,
        status: l.status,
        statusTone: jobStatusTone(l.status),
        createdAt: l.created_at,
      }));

    return {
      agents: agentViews,
      promptVersions,
      jobTrace,
      jobTraceTruncated,
    };
  },
);


// ── Declared vs Observed config (backlog P2c Phase A item 1) ─────────────────

type ObservedLogRow = {
  agent_name: string;
  model_used: string | null;
  prompt_version: string | null;
  duration_ms: number | null;
  cost_usd: number | null;
  status: string | null;
  created_at: string | null;
};

type ManifestFn = {
  promptVersions: string[];
  temperatures: number[];
  maxTokens: number[];
  providers: string[];
  dataforseoEndpoints: string[];
  moduleBudgetMs: number | null;
  retryDelaysMs: number[] | null;
  routerTasks: { task: string; codeDefault: string }[];
  gatingColumn: string | null;
};
type ManifestAgent = {
  functions: string[];
  schedule: string | null;
  routerTasks: string[];
  promptVersions: string[];
};
const MANIFEST_FUNCTIONS = agentManifest.functions as unknown as Record<string, ManifestFn>;
const MANIFEST_AGENTS = agentManifest.agents as unknown as Record<string, ManifestAgent>;

function buildAgentConfigs(
  routerRows: {
    task_type: string;
    primary_model: string;
    fallback_model: string | null;
    temperature: number | null;
    max_tokens: number | null;
  }[],
  logs: ObservedLogRow[],
  prefRows: Record<string, boolean | null>[],
): Map<string, AgentConfigView> {
  const routerByTask = new Map(routerRows.map((r) => [r.task_type, r]));

  // Count brands with each module explicitly disabled.
  const disabledByColumn = new Map<string, number>();
  for (const row of prefRows) {
    for (const [col, val] of Object.entries(row)) {
      if (val === false) disabledByColumn.set(col, (disabledByColumn.get(col) ?? 0) + 1);
    }
  }

  const out = new Map<string, AgentConfigView>();
  for (const [agentName, entry] of Object.entries(MANIFEST_AGENTS)) {
    const fns = entry.functions
      .map((f) => [f, MANIFEST_FUNCTIONS[f]] as const)
      .filter(([, v]) => Boolean(v));

    const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
    const declared = {
      promptVersions: entry.promptVersions,
      temperatures: uniq(fns.flatMap(([, f]) => f.temperatures)).sort((a, b) => a - b),
      maxTokens: uniq(fns.flatMap(([, f]) => f.maxTokens)).sort((a, b) => a - b),
      providers: uniq(fns.flatMap(([, f]) => f.providers)),
      dataforseoEndpoints: uniq(fns.flatMap(([, f]) => f.dataforseoEndpoints)),
      moduleBudgetMs: fns.map(([, f]) => f.moduleBudgetMs).find((v) => v != null) ?? null,
      retryDelaysMs: fns.map(([, f]) => f.retryDelaysMs).find((v) => v != null) ?? null,
      schedule: entry.schedule,
      routerRules: entry.routerTasks
        .filter((t) => routerByTask.has(t))
        .map((t) => {
          const r = routerByTask.get(t)!;
          return {
            task: t,
            primaryModel: r.primary_model,
            fallbackModel: r.fallback_model,
            temperature: r.temperature,
            maxTokens: r.max_tokens,
          };
        }),
      gating: fns
        .map(([, f]) => f.gatingColumn)
        .filter((c): c is string => Boolean(c))
        .map((column) => ({ column, disabledBrands: disabledByColumn.get(column) ?? 0 })),
      functions: entry.functions,
      manifestGeneratedAt: agentManifest.generatedAt,
    };

    const mine = logs.filter((l) => l.agent_name === agentName);
    let observed: AgentConfigView["observed"] = null;
    if (mine.length > 0) {
      const failures = mine.filter((l) => l.status === "failed").length;
      const withDuration = mine.filter((l) => l.duration_ms != null);
      const withCost = mine.filter((l) => l.cost_usd != null);
      observed = {
        runs: mine.length,
        failures,
        avgDurationMs: withDuration.length
          ? Math.round(withDuration.reduce((a, l) => a + (l.duration_ms ?? 0), 0) / withDuration.length)
          : null,
        avgCostUsd: withCost.length
          ? withCost.reduce((a, l) => a + Number(l.cost_usd ?? 0), 0) / withCost.length
          : null,
        lastModel: mine[0]?.model_used ?? null,
        lastPromptVersion: mine[0]?.prompt_version ?? null,
        lastRunAt: mine[0]?.created_at ?? null,
      };
    }

    // Drift: reality disagreeing with declared config.
    const drift: string[] = [];
    if (observed?.lastModel) {
      const declaredModels = new Set(
        declared.routerRules.flatMap((r) => [r.primaryModel, r.fallbackModel]).filter(Boolean),
      );
      if (declaredModels.size > 0 && !declaredModels.has(observed.lastModel)) {
        drift.push(
          `Last run used ${observed.lastModel}, which is not in this agent's routed models.`,
        );
      }
    }
    if (
      observed?.lastPromptVersion &&
      declared.promptVersions.length > 0 &&
      !declared.promptVersions.includes(observed.lastPromptVersion)
    ) {
      drift.push(
        `Last run executed prompt "${observed.lastPromptVersion}", not in the declared set (deployed functions may be older than the repo).`,
      );
    }

    out.set(agentName, { declared, observed, drift });
  }
  return out;
}
