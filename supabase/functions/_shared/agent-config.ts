// Agent Config Loader — runtime-fetched agent parameters (model, temperature, max_tokens).
// All agent execution is fully dynamic: prompts come from prompt_versions, model configs
// come from model_router_config, and Zod schemas validate outputs. Never hardcode.

import { z } from "https://deno.land/x/zod@3.22.4/mod.ts";
import type { SupabaseClient } from "./supabase.ts";

/** Runtime agent configuration fetched from model_router_config. */
export type AgentConfig = {
  taskType: string;
  model: string;
  temperature: number;
  maxTokens: number;
  fallbackModel?: string;
};

const configCache = new Map<string, { config: AgentConfig; fetchedAt: number }>();
const CONFIG_TTL_MS = 5 * 60_000;

/** Load agent config dynamically from model_router_config (cached 5 min per instance). */
export async function getAgentConfig(
  sb: SupabaseClient,
  taskType: string,
  defaults?: Partial<AgentConfig>,
): Promise<AgentConfig> {
  const now = Date.now();
  const cached = configCache.get(taskType);
  if (cached && now - cached.fetchedAt < CONFIG_TTL_MS) {
    return cached.config;
  }

  try {
    const { data, error } = await sb
      .from("model_router_config")
      .select("task_type, primary_model, fallback_model, temperature, max_tokens")
      .eq("task_type", taskType)
      .eq("is_active", true)
      .maybeSingle();

    if (error || !data) {
      const fallback = defaults || getDefaultConfig(taskType);
      configCache.set(taskType, { config: fallback, fetchedAt: now });
      return fallback;
    }

    const config: AgentConfig = {
      taskType: data.task_type,
      model: data.primary_model || "claude-sonnet-4-6",
      temperature: data.temperature ?? 0.3,
      maxTokens: data.max_tokens ?? 2000,
      fallbackModel: data.fallback_model,
    };

    configCache.set(taskType, { config, fetchedAt: now });
    return config;
  } catch (_e) {
    const fallback = defaults || getDefaultConfig(taskType);
    configCache.set(taskType, { config: fallback, fetchedAt: now });
    return fallback;
  }
}

/** Sensible defaults by task type when config is unavailable. */
function getDefaultConfig(taskType: string): AgentConfig {
  const defaults: Record<string, AgentConfig> = {
    "researcher_summarizer": {
      taskType: "researcher_summarizer",
      model: "claude-haiku-4-5",
      temperature: 0.2,
      maxTokens: 400,
    },
    "synthesis": {
      taskType: "synthesis",
      model: "claude-sonnet-4-6",
      temperature: 0.3,
      maxTokens: 4500,
    },
  };
  return defaults[taskType] || {
    taskType,
    model: "claude-sonnet-4-6",
    temperature: 0.3,
    maxTokens: 2000,
  };
}

// ── Zod Schemas for Structured Output Validation ──

/** Per-module synthesis summary: lightweight, ~100 tokens. */
export const SynthesisSummarySchema = z.object({
  status: z.enum(["threat", "neutral", "opportunity"]),
  key_takeaways: z.array(z.string()).min(1).max(3),
  recommended_angle: z.string(),
});

export type SynthesisSummary = z.infer<typeof SynthesisSummarySchema>;

/** Cross-module synthesis output: brief + evidence-backed recommendations. */
export const SynthesisOutputSchema = z.object({
  brief: z.object({
    summary: z.string(),
    market_position: z.string(),
    top_threats: z.array(z.string()),
    top_opportunities: z.array(z.string()),
    notable_competitor_moves: z.array(z.string()),
    regulatory_flags: z.array(z.string()),
    modules_covered: z.array(z.string()),
  }),
  recommendations: z.array(
    z.object({
      urgency: z.enum(["urgent", "watch", "opportunity", "info"]),
      category: z.string(),
      headline: z.string(),
      trigger_reason: z.string(),
      evidence: z.array(
        z.object({
          source_url: z.string(),
          timestamp: z.string(),
          extracted_text: z.string(),
          change_before: z.string().nullable().optional(),
          change_after: z.string().nullable().optional(),
          evidence_hash: z.string().nullable().optional(),
        }),
      ),
      assumption_flags: z.array(z.string()),
      is_direct_evidence: z.boolean(),
      confidence_score: z.number().min(0).max(1),
    }),
  ),
});

export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;

/** Retry logic: validate output, return safe default on repeated failures. */
export async function validateAndRetry<T>(
  fn: () => Promise<string>,
  schema: z.ZodSchema<T>,
  label: string,
  maxRetries: number = 1,
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const text = await fn();
      return schema.parse(JSON.parse(text)) as T;
    } catch (e) {
      if (attempt <= maxRetries) {
        console.warn(`${label} validation failed (attempt ${attempt}), retrying...`);
        continue;
      }
      console.error(`${label} validation failed after ${maxRetries} retries:`, e instanceof Error ? e.message : String(e));
      return null;
    }
  }
  return null;
}
