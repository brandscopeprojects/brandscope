import "server-only";

/**
 * Server-only LLM helpers for Brandscope route handlers.
 *
 * Wraps the raw Anthropic Messages API, the OpenAI Chat Completions API and the
 * OpenAI Moderation API behind small typed fetch helpers. API keys are read from
 * process.env at call time and NEVER reach the client (this file is server-only).
 *
 * Honesty rule (CLAUDE.md): when a key is missing we return a typed
 * `{ ok: false, reason: "not_configured" }` result — callers surface a clear
 * "AI not configured" error. We never fabricate an asset or an answer.
 */

// Exact model ids mandated by docs/skills/mvp-module-sources.md.
export const CLAUDE_SONNET_MODEL = "claude-sonnet-4-6";
export const OPENAI_CHAT_MODEL = "gpt-4.1-mini";
export const OPENAI_MODERATION_MODEL = "omni-moderation-latest";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODERATION_URL = "https://api.openai.com/v1/moderations";

export type LlmFailure =
  | { ok: false; reason: "not_configured"; message: string }
  | { ok: false; reason: "upstream_error"; message: string };

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AnthropicResult =
  | { ok: true; text: string; model: string; inputTokens: number; outputTokens: number }
  | LlmFailure;

export type OpenAiChatResult =
  | { ok: true; text: string; model: string; totalTokens: number }
  | LlmFailure;

export type ModerationResult =
  | { ok: true; flagged: boolean; raw: unknown }
  | LlmFailure;

/** Is the Anthropic key present? (no value ever logged or returned) */
export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Is the OpenAI key present? */
export function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Call Claude Sonnet 4.6 via the Anthropic Messages API. */
export async function anthropicComplete(args: {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<AnthropicResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "not_configured", message: "Anthropic API key is not configured." };
  }

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: CLAUDE_SONNET_MODEL,
        max_tokens: args.maxTokens ?? 2048,
        system: args.system,
        messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
  } catch (err) {
    return { ok: false, reason: "upstream_error", message: errorText(err) };
  }

  if (!res.ok) {
    return { ok: false, reason: "upstream_error", message: `Anthropic returned ${res.status}.` };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    return { ok: false, reason: "upstream_error", message: errorText(err) };
  }

  const text = extractAnthropicText(body);
  const usage = (body as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  return {
    ok: true,
    text,
    model: CLAUDE_SONNET_MODEL,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
  };
}

/** Call OpenAI GPT-4.1 Mini via the Chat Completions API. */
export async function openAiChat(args: {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<OpenAiChatResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "not_configured", message: "OpenAI API key is not configured." };
  }

  let res: Response;
  try {
    res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_CHAT_MODEL,
        max_tokens: args.maxTokens ?? 1024,
        messages: [
          { role: "system", content: args.system },
          ...args.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
  } catch (err) {
    return { ok: false, reason: "upstream_error", message: errorText(err) };
  }

  if (!res.ok) {
    return { ok: false, reason: "upstream_error", message: `OpenAI returned ${res.status}.` };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    return { ok: false, reason: "upstream_error", message: errorText(err) };
  }

  const text = extractOpenAiText(body);
  const totalTokens =
    (body as { usage?: { total_tokens?: number } }).usage?.total_tokens ?? 0;
  return { ok: true, text, model: OPENAI_CHAT_MODEL, totalTokens };
}

/** OpenAI Moderation (omni-moderation-latest) on a block of text. */
export async function moderateText(text: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "not_configured", message: "OpenAI API key is not configured." };
  }

  let res: Response;
  try {
    res = await fetch(OPENAI_MODERATION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: OPENAI_MODERATION_MODEL, input: text }),
    });
  } catch (err) {
    return { ok: false, reason: "upstream_error", message: errorText(err) };
  }

  if (!res.ok) {
    return { ok: false, reason: "upstream_error", message: `OpenAI moderation returned ${res.status}.` };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    return { ok: false, reason: "upstream_error", message: errorText(err) };
  }

  const results = (body as { results?: Array<{ flagged?: boolean }> }).results;
  const flagged = Array.isArray(results) && results.some((r) => r.flagged === true);
  return { ok: true, flagged, raw: body };
}

function extractAnthropicText(body: unknown): string {
  const content = (body as { content?: Array<{ type?: string; text?: string }> }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .trim();
}

function extractOpenAiText(body: unknown): string {
  const choices = (body as {
    choices?: Array<{ message?: { content?: string } }>;
  }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  return (choices[0]?.message?.content ?? "").trim();
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected network error.";
}
