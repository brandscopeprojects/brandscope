import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
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
    const supabase = createAdminClient();

    const [
      { data: agents },
      { data: skills },
      { data: logs },
      { data: prompts },
    ] = await Promise.all([
      supabase
        .from("agents")
        .select(
          "id, name, display_name, description, model, status, current_version",
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
    ]);

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
