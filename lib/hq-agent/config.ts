import "server-only";

// HQ Agent configuration: required-env validation, model resolution, supported
// voices, the default config document, and load/save against hq_agent_config.
//
// Model ids and the API key come ONLY from server-side env vars. The key is never
// returned to the client — `hasOpenAiKey()`/`requireOpenAiKey()` gate access.

import type { Admin, HqConfig, ToolCategory } from "./types";

// ── Models (env-configurable; safe defaults per §3/§14) ─────────────────────
export const DEFAULT_TEXT_MODEL = "gpt-4o-mini";
export const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1-mini";

export function textModel(): string {
  return process.env.OPENAI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL;
}
export function realtimeModel(): string {
  return process.env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_REALTIME_MODEL;
}

/** Realtime output voices supported by the config screen (§13-D). */
export const SUPPORTED_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"] as const;
export type SupportedVoice = (typeof SUPPORTED_VOICES)[number];

// ── Env validation (§3/§16 "missing OpenAI API key") ────────────────────────
export function hasOpenAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function requireOpenAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  return key;
}

/** Documented startup/runtime validation for required + optional env vars.
 *  Returns the missing REQUIRED vars (empty = healthy). Optional model vars fall
 *  back to defaults and are reported separately, never as failures. */
export function validateHqEnv(): { ok: boolean; missing: string[]; usingDefaults: string[] } {
  const missing: string[] = [];
  if (!process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
  const usingDefaults: string[] = [];
  if (!process.env.OPENAI_TEXT_MODEL) usingDefaults.push(`OPENAI_TEXT_MODEL=${DEFAULT_TEXT_MODEL}`);
  if (!process.env.OPENAI_REALTIME_MODEL) usingDefaults.push(`OPENAI_REALTIME_MODEL=${DEFAULT_REALTIME_MODEL}`);
  return { ok: missing.length === 0, missing, usingDefaults };
}

// ── Default config document (§14) ───────────────────────────────────────────
const ALL_CATEGORIES: ToolCategory[] = [
  "customers",
  "subscriptions",
  "finance",
  "campaigns",
  "operations",
  "llm_usage",
  "provider_health",
];

export const DEFAULT_SUGGESTIONS = [
  "Give me today's management briefing.",
  "How many brands have registered, and on which plans?",
  "Are all scans running? Is anything stuck or failing?",
  "What did we spend on LLMs in the last 30 days, by task?",
  "What requires management attention today?",
  "Which customers appear to be at risk?",
  "Which campaigns underperformed this week?",
  "Are any providers or integrations degraded?",
];

export const DEFAULT_HQ_CONFIG: HqConfig = {
  identity: {
    name: "HQ Agent",
    description: "Internal executive intelligence for authorised Brandscope management.",
    welcomeMessage: "Ask anything about the Brandscope business.",
    suggestedQuestions: DEFAULT_SUGGESTIONS,
  },
  instructions: {
    additionalInstructions: "",
    restrictedTopics: "",
  },
  text: {
    enabled: true,
    streaming: true,
    responseStyle: "concise",
    maxOutputTokens: 800,
    recentMessageLimit: 20,
  },
  voice: {
    enabled: true,
    voice: "alloy",
    transcriptVisible: true,
    saveTranscript: true,
    turnDetection: true,
    interruptions: true,
    maxSessionMinutes: 10,
    idleTimeoutSeconds: 60,
    maxSpokenResponseSeconds: 45,
  },
  data: {
    readOnly: true,
    showSources: true,
    showFreshness: true,
    categories: Object.fromEntries(ALL_CATEGORIES.map((c) => [c, true])) as Record<ToolCategory, boolean>,
  },
  safety: {
    requireConfirmationForWriteActions: true,
    unsupportedAnswerPolicy: "disclose_missing_data",
  },
  usage: {
    textRequestsPerMin: 20,
    realtimeSessionsPerHour: 20,
    dailyVoiceMinuteLimit: 120,
    monthlyBudgetWarningUsd: 200,
  },
};

/** Deep-merge a stored partial config over the defaults so new keys always exist. */
export function mergeConfig(stored: unknown): HqConfig {
  const s = (stored ?? {}) as Partial<HqConfig>;
  const d = DEFAULT_HQ_CONFIG;
  return {
    identity: { ...d.identity, ...s.identity, suggestedQuestions: s.identity?.suggestedQuestions?.length ? s.identity.suggestedQuestions : d.identity.suggestedQuestions },
    instructions: { ...d.instructions, ...s.instructions },
    text: { ...d.text, ...s.text },
    voice: { ...d.voice, ...s.voice },
    data: { ...d.data, ...s.data, categories: { ...d.data.categories, ...s.data?.categories } },
    safety: { ...d.safety, ...s.safety },
    usage: { ...d.usage, ...s.usage },
  };
}

const clamp = (v: unknown, lo: number, hi: number, dflt: number): number => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : dflt;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

/** Merge over defaults, then clamp every numeric/enum field to a safe range.
 *  Used before persisting an admin-submitted config. */
export function normalizeConfig(input: unknown): HqConfig {
  const c = mergeConfig(input);
  const style = (["concise", "balanced", "detailed"] as const).includes(c.text.responseStyle) ? c.text.responseStyle : "concise";
  const voice = (SUPPORTED_VOICES as readonly string[]).includes(c.voice.voice) ? c.voice.voice : "alloy";
  return {
    ...c,
    identity: {
      ...c.identity,
      name: String(c.identity.name ?? "HQ Agent").slice(0, 80),
      description: String(c.identity.description ?? "").slice(0, 500),
      welcomeMessage: String(c.identity.welcomeMessage ?? "").slice(0, 300),
      suggestedQuestions: (c.identity.suggestedQuestions ?? []).map((q) => String(q).slice(0, 200)).slice(0, 12),
    },
    instructions: {
      additionalInstructions: String(c.instructions.additionalInstructions ?? "").slice(0, 8000),
      restrictedTopics: String(c.instructions.restrictedTopics ?? "").slice(0, 2000),
    },
    text: {
      ...c.text,
      enabled: Boolean(c.text.enabled),
      streaming: Boolean(c.text.streaming),
      responseStyle: style,
      maxOutputTokens: clamp(c.text.maxOutputTokens, 256, 4096, 800),
      recentMessageLimit: clamp(c.text.recentMessageLimit, 4, 100, 20),
    },
    voice: {
      ...c.voice,
      enabled: Boolean(c.voice.enabled),
      voice,
      transcriptVisible: Boolean(c.voice.transcriptVisible),
      saveTranscript: Boolean(c.voice.saveTranscript),
      turnDetection: Boolean(c.voice.turnDetection),
      interruptions: Boolean(c.voice.interruptions),
      maxSessionMinutes: clamp(c.voice.maxSessionMinutes, 1, 30, 10),
      idleTimeoutSeconds: clamp(c.voice.idleTimeoutSeconds, 15, 300, 60),
      maxSpokenResponseSeconds: clamp(c.voice.maxSpokenResponseSeconds, 10, 120, 45),
    },
    usage: {
      textRequestsPerMin: clamp(c.usage.textRequestsPerMin, 0, 600, 20),
      realtimeSessionsPerHour: clamp(c.usage.realtimeSessionsPerHour, 0, 200, 20),
      dailyVoiceMinuteLimit: clamp(c.usage.dailyVoiceMinuteLimit, 0, 1000, 120),
      monthlyBudgetWarningUsd: clamp(c.usage.monthlyBudgetWarningUsd, 0, 100000, 200),
    },
  };
}

/** Load the published config (falls back to defaults when none is saved). */
export async function loadPublishedConfig(admin: Admin): Promise<HqConfig> {
  const { data } = await admin
    .from("hq_agent_config")
    .select("config")
    .eq("status", "published")
    .maybeSingle();
  return mergeConfig(data?.config);
}

/** Load the draft config, or the published one if no draft exists. */
export async function loadDraftOrPublished(admin: Admin): Promise<{ config: HqConfig; status: "draft" | "published" | "default" }> {
  const { data: draft } = await admin.from("hq_agent_config").select("config").eq("status", "draft").maybeSingle();
  if (draft) return { config: mergeConfig(draft.config), status: "draft" };
  const { data: pub } = await admin.from("hq_agent_config").select("config").eq("status", "published").maybeSingle();
  if (pub) return { config: mergeConfig(pub.config), status: "published" };
  return { config: DEFAULT_HQ_CONFIG, status: "default" };
}
