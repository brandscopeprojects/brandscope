// Client-safe mirror of the HQ Agent config document (server type lives in
// lib/hq-agent/types.ts, which is `server-only` and must not enter the client
// bundle). Shapes MUST match the API contract in /api/hq-agent/config.

export type ResponseStyle = "concise" | "balanced" | "detailed";

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

export type HqTextConfig = {
  enabled: boolean;
  streaming: boolean;
  responseStyle: ResponseStyle;
  maxOutputTokens: number;
  recentMessageLimit: number;
};

export type HqVoiceConfig = {
  enabled: boolean;
  voice: string;
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
  categories: Record<string, boolean>;
};

export type HqSafetyConfig = {
  requireConfirmationForWriteActions: boolean;
  unsupportedAnswerPolicy: string;
};

export type HqUsageConfig = {
  textRequestsPerMin: number;
  realtimeSessionsPerHour: number;
  dailyVoiceMinuteLimit: number;
  monthlyBudgetWarningUsd: number;
};

export type HqConfig = {
  identity: HqIdentityConfig;
  instructions: HqInstructionsConfig;
  text: HqTextConfig;
  voice: HqVoiceConfig;
  data: HqDataConfig;
  safety: HqSafetyConfig;
  usage: HqUsageConfig;
};

export type ConfigStatus = "draft" | "published" | "default";

export type EnvStatus = {
  ok: boolean;
  missing: string[];
  usingDefaults: string[];
};

export type ToolCategoryMeta = { key: string; label: string };

export type ConfigResponse = {
  ok: boolean;
  config: HqConfig;
  status: ConfigStatus;
  env: EnvStatus;
  models: { text: string; realtime: string };
  voices: string[];
  toolCategories: ToolCategoryMeta[];
  defaults: HqConfig;
};

/** A typed patch helper: shallow-merge a partial into one config section. */
export type PatchFn = <K extends keyof HqConfig>(
  key: K,
  value: Partial<HqConfig[K]>,
) => void;
