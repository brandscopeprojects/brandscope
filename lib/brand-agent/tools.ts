import "server-only";

// Brand-scoped, read-only tools for the brand-facing chat. Mirrors the HQ Agent's
// tool pattern (narrow, typed, no arbitrary SQL) but every query is scoped to ONE
// brand and runs through the caller's RLS-scoped Supabase client — so a brand user
// can only ever read their own brand's data. Tools read the denormalised
// weekly_cache snapshot (written by cache-population) + the recommendations table.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type BrandChatClient = SupabaseClient<Database>;

export type BrandToolContext = {
  /** RLS-scoped session client — enforces brand isolation at the DB layer. */
  supabase: BrandChatClient;
  brandId: string;
  brandName: string;
  markets: string[];
};

export type BrandToolResult = { data: Record<string, unknown>; source?: string };

export type BrandTool = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  run: (ctx: BrandToolContext, args: Record<string, unknown>) => Promise<BrandToolResult>;
};

/** module name (model-facing) → weekly_cache jsonb column holding that module's intel. */
const MODULE_COLUMN: Record<string, string> = {
  traffic_seo: "traffic_seo_data",
  geo: "geo_aeo_data",
  promotions: "promotions_data",
  customers: "customer_data",
  hiring: "hiring_data",
  regulatory: "regulatory_data",
  tech_stack: "tech_stack_data",
  product: "product_data",
  ads: "ads_data",
  social: "social_data",
};

type WeeklyRow = Record<string, unknown> | null;

/** The brand's most recent weekly_cache row (RLS-scoped). Null when no scan exists. */
async function latestWeekly(ctx: BrandToolContext): Promise<WeeklyRow> {
  const { data } = await ctx.supabase
    .from("weekly_cache")
    .select("*")
    .eq("brand_id", ctx.brandId)
    .order("scan_week", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as WeeklyRow) ?? null;
}

export const BRAND_TOOLS: BrandTool[] = [
  {
    name: "get_brand_snapshot",
    description:
      "The brand's latest weekly scan headline metrics: AI visibility score (and week-over-week trend), share of voice %, reach score, threat level/score, competitive aggression, competitors tracked, promo changes this week, and the scan week. Call this first for an overview.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    run: async (ctx) => {
      const w = await latestWeekly(ctx);
      if (!w) return { data: { available: false, note: "No scan has completed for this brand yet." } };
      return {
        data: {
          scan_week: w.scan_week,
          ai_visibility_score: w.ai_visibility_score,
          ai_visibility_trend: w.ai_visibility_trend,
          share_of_voice_pct: w.sov_pct,
          reach_score: w.reach_score,
          threat_level: w.threat_level,
          threat_score: w.threat_score,
          aggression_score: w.aggression_score,
          competitors_tracked: w.competitors_tracked,
          promo_changes_this_week: w.promo_changes_this_week,
          active_ads_count: w.active_ads_count,
        },
        source: `weekly scan ${w.scan_week}`,
      };
    },
  },
  {
    name: "get_competitor_standings",
    description:
      "Per-competitor standings for the latest scan — each competitor's reach score, share of voice %, threat score and aggression. Use this to compare competitors or answer who leads / gained the most on any metric.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    run: async (ctx) => {
      const w = await latestWeekly(ctx);
      const states = Array.isArray(w?.competitor_states) ? (w!.competitor_states as unknown[]) : [];
      if (states.length === 0) {
        return { data: { available: false, note: "No competitor standings for the latest scan." } };
      }
      return { data: { scan_week: w!.scan_week, competitors: states }, source: `weekly scan ${w!.scan_week}` };
    },
  },
  {
    name: "get_recommendations",
    description:
      "The brand's open action-plan recommendations for the latest scan: headline, urgency, the reason it was raised, category and rank. Optionally filter by urgency.",
    parameters: {
      type: "object",
      properties: {
        urgency: {
          type: "string",
          enum: ["urgent", "watch", "opportunity"],
          description: "Optional urgency filter.",
        },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const w = await latestWeekly(ctx);
      if (!w) return { data: { available: false, note: "No scan has completed yet, so there are no recommendations." } };
      let q = ctx.supabase
        .from("recommendations")
        .select("headline, urgency, trigger_reason, category, rank")
        .eq("brand_id", ctx.brandId)
        .eq("scan_week", w.scan_week as string)
        .eq("status", "open")
        .order("rank", { ascending: true })
        .limit(12);
      const urgency = typeof args.urgency === "string" ? args.urgency : null;
      if (urgency) q = q.eq("urgency", urgency);
      const { data } = await q;
      return { data: { scan_week: w.scan_week, recommendations: data ?? [] }, source: `action plan ${w.scan_week}` };
    },
  },
  {
    name: "get_module_intel",
    description:
      "Detailed intelligence for one module from the latest scan. module is one of: traffic_seo, geo, promotions, customers, hiring, regulatory, tech_stack, product, ads, social. Returns that module's structured data, or an honest 'no data' note when the source returned nothing.",
    parameters: {
      type: "object",
      properties: {
        module: { type: "string", enum: Object.keys(MODULE_COLUMN) },
      },
      required: ["module"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const module = typeof args.module === "string" ? args.module : "";
      const col = MODULE_COLUMN[module];
      if (!col) return { data: { error: `unknown module "${module}"` } };
      const w = await latestWeekly(ctx);
      if (!w) return { data: { available: false, module, note: "No scan has completed yet." } };
      const slice = (w as Record<string, unknown>)[col];
      if (slice == null) {
        return {
          data: {
            available: false,
            module,
            note: `No ${module} data in the latest scan — this module either returned no data for this market or is not yet enabled.`,
          },
          source: `weekly scan ${w.scan_week}`,
        };
      }
      return { data: { scan_week: w.scan_week, module, intel: slice }, source: `${module} · weekly scan ${w.scan_week}` };
    },
  },
];

/** OpenAI Responses `tools` array (function tools) for the brand tool set. */
export function brandToolsForModel() {
  return BRAND_TOOLS.map((t) => ({
    type: "function" as const,
    name: t.name,
    description: t.description,
    parameters: { ...t.parameters },
    strict: false,
  }));
}

export function getBrandTool(name: string): BrandTool | undefined {
  return BRAND_TOOLS.find((t) => t.name === name);
}
