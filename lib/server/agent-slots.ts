import "server-only";

// Prompt-slot metadata for the Agent Control editable console (P2c).
// Slot keys match prompt_versions.agent_name (schema-amendments D.7) and the
// loadPrompt() calls in the Edge Functions. Code-default temperature/maxTokens
// mirror the call-site defaults; sampleVars fill {{placeholders}} in sandbox
// runs. Templates themselves come from lib/data/agent-manifest.json
// (generated from function source).

import agentManifest from "@/lib/data/agent-manifest.json";
import { SLOT_OPTIONS } from "@/lib/agent-control-shared";

void SLOT_OPTIONS; // labels live client-side; server meta is keyed below

export type SlotMeta = {
  slot: string;
  label: string;
  agent: string; // agent_job_logs.agent_name for sandbox logging
  routerTask: string;
  codeDefaults: { temperature: number; maxTokens: number };
  sampleVars: Record<string, string>;
};

export const SLOT_META: SlotMeta[] = [
  { slot: "supervisor", label: "Supervisor — weekly brief", agent: "supervisor", routerTask: "synthesis", codeDefaults: { temperature: 0.3, maxTokens: 1200 }, sampleVars: {} },
  { slot: "drafter", label: "Drafter — recommendations", agent: "drafter", routerTask: "drafting", codeDefaults: { temperature: 0.3, maxTokens: 3000 }, sampleVars: { prev_headlines: "- (none)" } },
  { slot: "auditor", label: "Auditor — confidence scoring", agent: "auditor", routerTask: "audit", codeDefaults: { temperature: 0.3, maxTokens: 1500 }, sampleVars: {} },
  { slot: "researcher:promotions", label: "Researcher — promotions", agent: "researcher", routerTask: "researcher_structuring", codeDefaults: { temperature: 0.2, maxTokens: 400 }, sampleVars: { promo_types: "welcome_bonus, free_bet, odds_boost, cashback, acca_insurance, loyalty, referral, seasonal, casino_bonus, other" } },
  { slot: "researcher:geo_aeo", label: "Researcher — GEO probe analysis", agent: "researcher", routerTask: "geo_probe", codeDefaults: { temperature: 0, maxTokens: 2000 }, sampleVars: { brand_name: "Betvita" } },
  { slot: "researcher:traffic_seo", label: "Researcher — SEO content gaps", agent: "researcher", routerTask: "researcher_structuring", codeDefaults: { temperature: 0.1, maxTokens: 700 }, sampleVars: {} },
  { slot: "researcher:customer", label: "Researcher — customer intel", agent: "researcher", routerTask: "researcher_structuring", codeDefaults: { temperature: 0.2, maxTokens: 1200 }, sampleVars: {} },
  { slot: "researcher:hiring", label: "Researcher — hiring signals", agent: "researcher", routerTask: "researcher_structuring", codeDefaults: { temperature: 0.2, maxTokens: 1200 }, sampleVars: {} },
  { slot: "researcher:regulatory", label: "Researcher — regulatory RAG", agent: "researcher", routerTask: "regulatory_rag", codeDefaults: { temperature: 0.1, maxTokens: 1800 }, sampleVars: {} },
];

export const SLOT_KEYS = SLOT_META.map((s) => s.slot);

const slots = (agentManifest as { promptSlots: Record<string, { template: string }> }).promptSlots;

/** The code-default template for a slot (from the generated manifest). */
export function codeTemplate(slot: string): string | null {
  return slots[slot]?.template ?? null;
}

export function slotMeta(slot: string): SlotMeta | null {
  return SLOT_META.find((s) => s.slot === slot) ?? null;
}

/** {{placeholder}} interpolation — mirror of the Edge renderPrompt. */
export function renderPrompt(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : whole,
  );
}
