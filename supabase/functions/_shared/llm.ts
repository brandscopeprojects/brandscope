// LLM clients (MVP: Anthropic Claude + OpenAI only). Each call returns token
// usage + an estimated cost so the caller can write agent_job_logs (Rule 4).
// Fallback chain per data-flow-rules.md §4: Claude → Haiku → GPT-4.1-mini.

import { requireEnv, optionalEnv } from "./env.ts";
import { MODELS } from "./contracts.ts";
import { guardOutput } from "./guard.ts";
import { logAgentJob, type AgentJobLog } from "./logging.ts";
import type { SupabaseClient } from "./supabase.ts";

export type LlmResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  costUsd: number;
};

// Approximate USD per 1M tokens [input, output] — for cost logging only.
const RATES: Record<string, [number, number]> = {
  [MODELS.sonnet]: [3, 15],
  [MODELS.haiku]: [1, 5],
  [MODELS.gpt]: [0.4, 1.6],
};

function estimateCost(model: string, inTok: number, outTok: number): number {
  const [i, o] = RATES[model] ?? [0, 0];
  return (inTok / 1_000_000) * i + (outTok / 1_000_000) * o;
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Anthropic Messages API. Use MODELS.sonnet or MODELS.haiku. */
export async function callClaude(opts: {
  model: string;
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<LlmResult> {
  const key = requireEnv("ANTHROPIC_API_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 1500,
      temperature: opts.temperature ?? 0.3,
      system: opts.system,
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = guardOutput(
    (data.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n"),
  );
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  return {
    text,
    inputTokens,
    outputTokens,
    model: opts.model,
    costUsd: estimateCost(opts.model, inputTokens, outputTokens),
  };
}

/** OpenAI Chat Completions (MODELS.gpt — brand chat). */
export async function callOpenAIChat(opts: {
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<LlmResult> {
  const key = requireEnv("OPENAI_API_KEY");
  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    ...opts.messages,
  ];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELS.gpt,
      messages,
      max_tokens: opts.maxTokens ?? 1200,
      temperature: opts.temperature ?? 0.4,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = guardOutput(data.choices?.[0]?.message?.content ?? "");
  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;
  return {
    text,
    inputTokens,
    outputTokens,
    model: MODELS.gpt,
    costUsd: estimateCost(MODELS.gpt, inputTokens, outputTokens),
  };
}

/** OpenAI embeddings (text-embedding-3-small, 1536-dim) for regulatory RAG. */
export async function embed(input: string | string[]): Promise<number[][]> {
  const key = requireEnv("OPENAI_API_KEY");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODELS.embed, input }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.data ?? []).map((d: { embedding: number[] }) => d.embedding);
}

/** OpenAI moderation — gate generated assets before delivery. */
export async function moderate(
  input: string,
): Promise<{ flagged: boolean; result: unknown }> {
  const key = requireEnv("OPENAI_API_KEY");
  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODELS.moderation, input }),
  });
  if (!res.ok) throw new Error(`OpenAI moderation ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const result = data.results?.[0] ?? { flagged: false };
  return { flagged: Boolean(result.flagged), result };
}

/**
 * Run an LLM call and write its agent_job_logs row (Rule 4: no call without a
 * log). On error, logs status 'failed' and rethrows so the caller can retry/DLQ.
 */
export async function loggedLlm(
  sb: SupabaseClient,
  ctx: Omit<AgentJobLog, "status" | "input_tokens" | "output_tokens" | "total_tokens" | "cost_usd" | "duration_ms" | "model_used">,
  fn: () => Promise<LlmResult>,
): Promise<LlmResult> {
  const started = Date.now();
  try {
    const r = await fn();
    await logAgentJob(sb, {
      ...ctx,
      model_used: r.model,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      total_tokens: r.inputTokens + r.outputTokens,
      cost_usd: r.costUsd,
      duration_ms: Date.now() - started,
      status: "passed",
      output_snapshot: r.text,
    });
    return r;
  } catch (e) {
    await logAgentJob(sb, {
      ...ctx,
      duration_ms: Date.now() - started,
      status: "failed",
      error_message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

/** Parse JSON the model returned, tolerating ```json fences and stray prose. */
export function parseJsonFromModel<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
  if (start === -1 || end === -1) throw new Error("No JSON found in model output");
  return JSON.parse(raw.slice(start, end + 1)) as T;
}

export { optionalEnv };
