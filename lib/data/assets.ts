import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBrand } from "@/lib/data/brand";

// Assets Library data layer (Screen 16, /assets).
// Source: generated_assets (RLS-scoped by brand). Assets are written by the
// asset-generation flow (POST /api/assets/generate) off the back of a
// recommendation — that WRITE path is a later sprint. This module is read-only:
// it lists the brand's non-deleted assets, newest first, and parses the `content`
// JSONB defensively into a view model the grid can render.

/** Shape of the `content` JSONB column (Sprint-3 WRITE TARGET).
 *  Mirrors the AssetGenerationResult `asset` shape (ui-constraints §10):
 *  ordered sections (label + body) + optional recommended channels + budget. */
export type AssetContent = {
  sections: { label: string; body: string }[];
  channels?: string[];
  budget?: string;
};

/** One generated asset, mapped to a view model for the library grid. */
export type AssetListItem = {
  id: string;
  assetType: string;
  title: string;
  content: AssetContent;
  wordCount: number | null;
  isPinned: boolean;
  isPreGenerated: boolean;
  modelUsed: string | null;
  moderationFlagged: boolean;
  createdAt: string | null;
  scanWeek: string | null;
  recommendationId: string | null;
  shareToken: string | null;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Parse the `content` JSONB defensively — never trust its shape. */
function parseContent(raw: unknown): AssetContent {
  if (!isRecord(raw)) return { sections: [] };

  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .filter(isRecord)
        .map((s) => ({
          label: typeof s.label === "string" ? s.label : "",
          body: typeof s.body === "string" ? s.body : "",
        }))
        // Drop entries with neither a label nor a body.
        .filter((s) => s.label.length > 0 || s.body.length > 0)
    : [];

  const channels = Array.isArray(raw.channels)
    ? raw.channels.filter((c): c is string => typeof c === "string")
    : undefined;

  const budget = typeof raw.budget === "string" ? raw.budget : undefined;

  return {
    sections,
    ...(channels && channels.length > 0 ? { channels } : {}),
    ...(budget ? { budget } : {}),
  };
}

/** The brand's non-deleted generated assets, newest first.
 *  Returns an empty list (not null) when none exist yet — the page renders the
 *  honest "no assets yet" empty state from a clean [] (no fabricated rows). */
export async function getBrandAssets(): Promise<AssetListItem[]> {
  const brand = await getCurrentBrand();
  if (!brand) return [];

  const supabase = createClient();
  const { data: rows } = await supabase
    .from("generated_assets")
    .select(
      "id, asset_type, title, content, word_count, is_pinned, is_pre_generated, model_used, moderation_flagged, created_at, scan_week, recommendation_id, share_token",
    )
    .eq("brand_id", brand.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) return [];

  return rows.map((r): AssetListItem => ({
    id: r.id,
    assetType: r.asset_type,
    title: r.title,
    content: parseContent(r.content),
    wordCount: r.word_count,
    isPinned: r.is_pinned ?? false,
    isPreGenerated: r.is_pre_generated ?? false,
    modelUsed: r.model_used,
    moderationFlagged: r.moderation_flagged,
    createdAt: r.created_at,
    scanWeek: r.scan_week,
    recommendationId: r.recommendation_id,
    shareToken: r.share_token,
  }));
}
