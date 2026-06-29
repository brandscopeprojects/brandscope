// jsonb element shapes the researcher WRITES into seo_cache — these MUST match
// lib/data/traffic-seo.ts exactly (the frontend reads them back with no reshaping):
//   keyword_gaps[]  : { keyword, volume, competitorRank, brandRank, difficulty }
//   serp_positions[]: { keyword, position, url }
//   content_gaps[]  : { topic, competitorPages, brandPages }
// Numeric fields are nullable (never faked when DataForSEO returns nothing).

/** seo_cache.keyword_gaps[] element. */
export type KeywordGap = {
  keyword: string;
  volume: number | null;
  competitorRank: number | null;
  brandRank: number | null;
  difficulty: number | null;
};

/** seo_cache.serp_positions[] element. */
export type SerpPosition = {
  keyword: string;
  position: number | null;
  url: string | null;
};

/** seo_cache.content_gaps[] element. */
export type ContentGap = {
  topic: string;
  competitorPages: number | null;
  brandPages: number | null;
};
