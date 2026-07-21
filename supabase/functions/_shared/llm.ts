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

// Web-search tool surcharges (USD per grounded call) — for cost logging only.
// OpenAI web_search_preview ≈ $25/1k calls; Anthropic web_search $10/1k searches.
const OPENAI_WEB_SEARCH_CALL = 0.025;
const ANTHROPIC_WEB_SEARCH_CALL = 0.01;

/** Pull the assistant text out of an OpenAI Responses API body (web-search runs). */
function extractResponsesText(data: {
  output_text?: unknown;
  output?: Array<{ content?: Array<{ type?: string; text?: unknown }> }>;
}): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text;
  const parts: string[] = [];
  for (const item of data?.output ?? []) {
    for (const c of item?.content ?? []) {
      if (typeof c?.text === "string") parts.push(c.text);
    }
  }
  return parts.join("\n").trim();
}

/**
 * OpenAI Responses API with the web_search tool — a grounded answer-engine probe
 * used by GEO v2 to simulate what a real ChatGPT user sees. Direct-to-provider
 * (existing OPENAI_API_KEY) replaces the ~$0.20/query DataForSEO llm_responses
 * route with ~$0.01/query token cost + a small web-search surcharge.
 */
export async function callOpenAIWebSearch(opts: {
  prompt: string;
  model?: string;
  maxOutputTokens?: number;
}): Promise<LlmResult> {
  const key = requireEnv("OPENAI_API_KEY");
  const model = opts.model ?? MODELS.gpt;
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search_preview" }],
      input: opts.prompt,
      max_output_tokens: opts.maxOutputTokens ?? 1200,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI responses ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = guardOutput(extractResponsesText(data));
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  return {
    text,
    inputTokens,
    outputTokens,
    model,
    costUsd: estimateCost(model, inputTokens, outputTokens) + OPENAI_WEB_SEARCH_CALL,
  };
}

/**
 * Anthropic Messages API with the web_search server tool — grounded answer-engine
 * probe for GEO v2 (direct-to-provider via ANTHROPIC_API_KEY). Cost = tokens +
 * $0.01 per web search performed (usage.server_tool_use.web_search_requests).
 */
export async function callClaudeWebSearch(opts: {
  prompt: string;
  model?: string;
  maxTokens?: number;
  maxSearches?: number;
}): Promise<LlmResult> {
  const key = requireEnv("ANTHROPIC_API_KEY");
  const model = opts.model ?? MODELS.sonnet;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 1200,
      messages: [{ role: "user", content: opts.prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: opts.maxSearches ?? 3 }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic web search ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = guardOutput(
    (data.content ?? [])
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { text: string }) => c.text)
      .join("\n"),
  );
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  const searches = data.usage?.server_tool_use?.web_search_requests ?? 0;
  return {
    text,
    inputTokens,
    outputTokens,
    model,
    costUsd: estimateCost(model, inputTokens, outputTokens) + searches * ANTHROPIC_WEB_SEARCH_CALL,
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
