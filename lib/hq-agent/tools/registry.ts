import "server-only";

// The HQ Agent tool registry. Narrow, typed, read-only tools that wrap internal
// services — the model NEVER queries arbitrary tables or generates SQL. Tools are
// filtered by the config's enabled categories before being offered to the model,
// executed with a timeout + one safe retry, and every run is logged to
// hq_tool_runs (name, duration, success — never payloads/secrets).

import type { HqConfig, HqTool, HqToolContext, HqToolResult, ToolCategory } from "../types";
import { customerTools } from "./customers";
import { subscriptionTools } from "./subscriptions";
import { financeTools } from "./finance";
import { campaignTools } from "./campaigns";
import { operationsTools } from "./operations";
import { llmUsageTools } from "./llm-usage";
import { providerHealthTools } from "./provider-health";
import { knowledgeTools } from "./knowledge";

const ALL_TOOLS: HqTool[] = [
  ...operationsTools, // briefing first — the default management view
  ...customerTools,
  ...subscriptionTools,
  ...financeTools,
  ...campaignTools,
  ...llmUsageTools,
  ...providerHealthTools,
  ...knowledgeTools,
];

const TOOL_TIMEOUT_MS = 8000;
const MAX_TOOL_CALLS_PER_TURN = 8; // §8: cap tool calls per turn

export function getTool(name: string): HqTool | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

/** Categories enabled in config → the tools offered to the model this turn. */
export function enabledTools(config: HqConfig): HqTool[] {
  return ALL_TOOLS.filter((t) => config.data.categories[t.category as ToolCategory] !== false);
}

/** OpenAI Responses `tools` array (function tools) for the enabled set. */
export function toolsForModel(config: HqConfig) {
  return enabledTools(config).map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description,
    parameters: { ...t.parameters },
    strict: false,
  }));
}

/** Realtime function-tool declarations (same shape, minus `strict`). */
export function realtimeToolsForModel(config: HqConfig) {
  return enabledTools(config).map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description,
    parameters: { ...t.parameters },
  }));
}

export const MAX_TOOLS_PER_TURN = MAX_TOOL_CALLS_PER_TURN;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`tool timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export type ToolRunOutcome = {
  ok: boolean;
  result?: HqToolResult;
  error?: string;
  durationMs: number;
};

/**
 * Execute one tool: validate args, enforce category enablement + read-only, run
 * with a timeout and a single retry on transient failure, and log the run.
 * Returns a structured outcome — never throws to the caller.
 */
export async function runTool(
  ctx: HqToolContext,
  config: HqConfig,
  name: string,
  rawArgs: unknown,
  conversationId: string | null,
): Promise<ToolRunOutcome> {
  const start = Date.now();
  const tool = getTool(name);
  const log = async (success: boolean, error: string | null, updatedAt: string | null) => {
    try {
      await ctx.admin.from("hq_tool_runs").insert({
        conversation_id: conversationId,
        profile_id: ctx.profileId,
        tool_name: name,
        modality: ctx.modality,
        duration_ms: Date.now() - start,
        success,
        error_text: error,
        data_updated_at: updatedAt,
      });
    } catch {
      /* telemetry is best-effort */
    }
  };

  if (!tool) {
    await log(false, "unknown tool", null);
    return { ok: false, error: `unknown tool ${name}`, durationMs: Date.now() - start };
  }
  if (config.data.categories[tool.category] === false) {
    await log(false, "category disabled", null);
    return { ok: false, error: `the ${tool.category} data category is disabled`, durationMs: Date.now() - start };
  }

  let args: Record<string, unknown>;
  try {
    args = tool.validate(rawArgs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "invalid arguments";
    await log(false, msg, null);
    return { ok: false, error: `invalid arguments for ${name}: ${msg}`, durationMs: Date.now() - start };
  }

  const attempt = () => withTimeout(tool.run(ctx, args), TOOL_TIMEOUT_MS);
  try {
    let result: HqToolResult;
    try {
      result = await attempt();
    } catch {
      result = await attempt(); // one safe retry for a transient failure
    }
    await log(true, null, result.dataUpdatedAt);
    return { ok: true, result, durationMs: Date.now() - start };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "tool failed";
    await log(false, msg, null);
    return { ok: false, error: msg, durationMs: Date.now() - start };
  }
}
