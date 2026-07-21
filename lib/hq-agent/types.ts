import "server-only";

// Shared types for the HQ Agent (internal executive intelligence). Text chat runs
// on the OpenAI Responses API; voice on the OpenAI Realtime API over WebRTC. Both
// share one conversation and the same server-side tool registry.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type Admin = SupabaseClient<Database>;
export type Json = Record<string, unknown>;

export type Modality = "text" | "voice";

/** The seven data-access categories that can be toggled per §13-E. */
export type ToolCategory =
  | "customers"
  | "subscriptions"
  | "finance"
  | "campaigns"
  | "operations"
  | "llm_usage"
  | "provider_health"
  | "knowledge";

/** Context handed to every tool. The requesting user is already authorised
 *  (internal_admin/super_admin) by the route; tools receive the service-role
 *  client plus who is asking, for telemetry + tenant checks. */
export type HqToolContext = {
  admin: Admin;
  profileId: string;
  role: string;
  modality: Modality;
};

/** A source/citation returned alongside tool data (§8 "Data used" disclosure). */
export type HqSource = {
  service: string;
  dateRange?: string;
  updatedAt?: string | null;
  filters?: string;
};

/** Every tool returns typed data + freshness + sources. Never raw secrets. */
export type HqToolResult = {
  data: Json;
  /** Freshness of the underlying data (ISO), or null when not applicable. */
  dataUpdatedAt: string | null;
  sources: HqSource[];
  /** True when the underlying source is not yet integrated (honest gap, not an error). */
  notAvailable?: boolean;
};

/** A registered HQ tool. `parameters` is a JSON Schema for OpenAI function calling. */
export type HqTool = {
  name: string;
  category: ToolCategory;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  /** Validate + coerce raw model args; throw on invalid input. */
  validate: (raw: unknown) => Record<string, unknown>;
  run: (ctx: HqToolContext, args: Record<string, unknown>) => Promise<HqToolResult>;
};

// ── Config (§13/§14) ─────────────────────────────────────────────────────────

export type ResponseStyle = "concise" | "balanced" | "detailed";

export type HqTextConfig = {
  enabled: boolean;
  streaming: boolean;
  responseStyle: ResponseStyle;
  maxOutputTokens: number;
  recentMessageLimit: number;
};

export type HqVoiceConfig = {
  enabled: boolean;
  voice: string; // one of SUPPORTED_VOICES
  transcriptVisible: boolean;
  saveTranscript: boolean;
  turnDetection: boolean;
  interruptions: boolean;
  maxSessionMinutes: number;
  idleTimeoutSeconds: number;
  maxSpokenResponseSeconds: number;
};

export type HqDataConfig = {
  readOnly: boolean;
  showSources: boolean;
  showFreshness: boolean;
  /** Enabled tool categories. A disabled category's tools are withheld from the model. */
  categories: Record<ToolCategory, boolean>;
};

export type HqSafetyConfig = {
  requireConfirmationForWriteActions: boolean;
  unsupportedAnswerPolicy: "disclose_missing_data";
};

export type HqUsageConfig = {
  textRequestsPerMin: number;
  realtimeSessionsPerHour: number;
  dailyVoiceMinuteLimit: number;
  monthlyBudgetWarningUsd: number;
};

export type HqIdentityConfig = {
  name: string;
  description: string;
  welcomeMessage: string;
  suggestedQuestions: string[];
};

export type HqInstructionsConfig = {
  additionalInstructions: string;
  restrictedTopics: string;
};

/** The full product-level config document (stored in hq_agent_config.config). */
export type HqConfig = {
  identity: HqIdentityConfig;
  instructions: HqInstructionsConfig;
  text: HqTextConfig;
  voice: HqVoiceConfig;
  data: HqDataConfig;
  safety: HqSafetyConfig;
  usage: HqUsageConfig;
};

// ── SSE events emitted by /api/hq-agent/chat ────────────────────────────────
export type HqChatEvent =
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "tool"; name: string }
  | { type: "sources"; sources: HqSource[] }
  | { type: "done"; conversationId: string; reply: string; toolsUsed: string[]; messageId?: string; createdAt?: string; userMessageId?: string }
  | { type: "error"; error: string };
