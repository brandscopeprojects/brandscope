// DataForSEO App-Store data helpers for the App-Store Researcher.
// Provider: DataForSEO ONLY (mvp-module-sources.md §5). All calls go through the
// shared dfs* client (Basic auth). Everything here is BOUNDED so the module stays
// inside its 90s budget: review counts are capped and task_post polling is short.
//
// DataForSEO app_data needs an app identifier (Google Play package id like
// "com.foo.bar"; Apple numeric track id). We do NOT have those on the competitor
// row — we only have name/domain. So we first DISCOVER candidate apps for the
// competitor via dataforseo_labs app_keywords/app_competitors (which key off an
// app id too) and the app_data app_info "search"-style task. In practice the
// reliable path at MVP is: try app_info by the competitor's likely package/app id
// derived from the domain, and if DataForSEO returns nothing we degrade to
// "no app found" (no fabricated data). Field names are confirmed-at-build per
// mvp-module-sources.md §"Endpoints used at MVP but NOT detailed".

import { dfsPost, dfsGet, firstResult, dfsTaskPostAndPoll } from "../_shared/dataforseo.ts";

/** Lagos / Nigeria default targeting for app data. */
const LOCATION_NAME = "Nigeria";

// app_data endpoints take language_name (not language_code); map the shared
// languageCode() output to DataForSEO's language names. Fallback English.
const LANGUAGE_NAME_BY_CODE: Record<string, string> = {
  en: "English",
  pt: "Portuguese",
  fr: "French",
  es: "Spanish",
  ar: "Arabic",
  de: "German",
  it: "Italian",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
  ru: "Russian",
};

export type AppRef = {
  store: "google" | "apple";
  /** Google Play package id (e.g. com.bet9ja.mobile) or Apple track id. */
  appId: string;
  title?: string | null;
  storeUrl?: string | null;
};

export type AppInfo = {
  ref: AppRef;
  rating: number | null;
  reviewCount: number | null;
  title: string | null;
  categories: string[];
  description: string | null;
  /** Latest "what's new" / release notes, used for new-feature detection. */
  releaseNotes: string | null;
  storeUrl: string | null;
};

export type AppReview = {
  text: string;
  rating: number | null;
  date: string | null;
  store: "google" | "apple";
};

/** Derive a plausible Google Play package id from a domain (best-effort guess). */
export function guessPackageIds(domain: string, name: string): string[] {
  const host = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  const parts = host.split(".").filter(Boolean);
  // strip a leading www
  if (parts[0] === "www") parts.shift();
  const sld = parts[0] ?? host; // second-level domain, e.g. "bet9ja"
  const tld = parts.slice(1).join("."); // e.g. "com" / "com.ng"
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const ids = new Set<string>();
  if (tld && sld) {
    ids.add(`${tld}.${sld}`); // com.bet9ja
    ids.add(`${tld}.${sld}.mobile`);
    ids.add(`${tld}.${sld}.app`);
  }
  if (slug) {
    ids.add(`com.${slug}`);
    ids.add(`com.${slug}.app`);
    ids.add(`com.${slug}.mobile`);
  }
  return [...ids].slice(0, 4);
}

/**
 * Resolve the competitor's Google-Play app via app_info task_post, trying a small
 * set of guessed package ids until one returns data. Returns null when no app is
 * found (degrade gracefully — never fabricate).
 */
export async function fetchGoogleAppInfo(
  candidateIds: string[],
  budgetMs: number,
  language = "en",
): Promise<AppInfo | null> {
  const languageName = LANGUAGE_NAME_BY_CODE[language] ?? "English";
  const deadline = Date.now() + budgetMs;
  for (const appId of candidateIds) {
    if (Date.now() > deadline) break;
    try {
      const results = await dfsTaskPostAndPoll<Record<string, unknown>>(
        "app_data/google/app_info/task_post",
        "app_data/google/app_info/task_get",
        [{ app_id: appId, location_name: LOCATION_NAME, language_name: languageName }],
        { maxWaitMs: Math.min(20_000, Math.max(0, deadline - Date.now())), intervalMs: 3_000 },
      );
      const info = mapGoogleAppInfo(results, appId);
      if (info) return info;
    } catch (_e) {
      // try the next candidate id
    }
  }
  return null;
}

function mapGoogleAppInfo(
  results: Record<string, unknown>[],
  appId: string,
): AppInfo | null {
  for (const res of results) {
    const items = (res.items as Record<string, unknown>[] | undefined) ?? [];
    const item = items[0] ?? (res as Record<string, unknown>);
    const rating = readRating(item);
    const title = readString(item.title) ?? readString(item.name);
    const reviewCount = readNumber(item.reviews_count) ?? readNumber(item.rating_count);
    if (rating == null && reviewCount == null && !title) continue;
    return {
      ref: { store: "google", appId, title, storeUrl: readString(item.url) },
      rating,
      reviewCount,
      title,
      categories: readStringArray(item.categories),
      description: readString(item.description),
      releaseNotes: readString(item.recent_changes) ?? readString(item.whatsnew),
      storeUrl: readString(item.url) ??
        `https://play.google.com/store/apps/details?id=${appId}`,
    };
  }
  return null;
}

/**
 * Fetch up to `cap` Google-Play reviews for an app, bounded by `budgetMs`.
 * DataForSEO returns ~100 reviews/task page; we ask for one bounded page.
 */
export async function fetchGoogleReviews(
  appId: string,
  cap: number,
  budgetMs: number,
  language = "en",
): Promise<AppReview[]> {
  const languageName = LANGUAGE_NAME_BY_CODE[language] ?? "English";
  try {
    const results = await dfsTaskPostAndPoll<Record<string, unknown>>(
      "app_data/google/app_reviews/task_post",
      "app_data/google/app_reviews/task_get",
      [{
        app_id: appId,
        location_name: LOCATION_NAME,
        language_name: languageName,
        depth: Math.min(cap, 200),
        sort_by: "newest",
      }],
      { maxWaitMs: Math.min(30_000, budgetMs), intervalMs: 4_000 },
    );
    return mapReviews(results, "google").slice(0, cap);
  } catch (_e) {
    return [];
  }
}

function mapReviews(
  results: Record<string, unknown>[],
  store: "google" | "apple",
): AppReview[] {
  const out: AppReview[] = [];
  for (const res of results) {
    const items = (res.items as Record<string, unknown>[] | undefined) ?? [];
    for (const it of items) {
      const text = readString(it.review_text) ?? readString(it.text) ?? readString(it.content);
      if (!text) continue;
      out.push({
        text,
        rating: readNumber(it.rating) ?? readRating(it),
        date: readString(it.timestamp) ?? readString(it.date),
        store,
      });
    }
  }
  return out;
}

/**
 * dataforseo_labs google app_competitors + app_keywords — vertical signals.
 * Live endpoints. Returns competitor app titles + ranked keywords (used as soft
 * signals for which verticals the app covers). Bounded, best-effort.
 */
export async function fetchVerticalSignals(appId: string, language = "en"): Promise<{
  competitorApps: string[];
  keywords: string[];
}> {
  const languageName = LANGUAGE_NAME_BY_CODE[language] ?? "English";
  const competitorApps: string[] = [];
  const keywords: string[] = [];
  try {
    const comp = await dfsPost<{ tasks?: Array<{ result?: Record<string, unknown>[] }> }>(
      "dataforseo_labs/google/app_competitors/live",
      [{ app_id: appId, location_name: LOCATION_NAME, language_name: languageName, limit: 20 }],
    );
    for (const res of firstResult<Record<string, unknown>>(comp)) {
      for (const it of (res.items as Record<string, unknown>[] | undefined) ?? []) {
        const t = readString(it.title) ?? readString((it.app_info as Record<string, unknown>)?.title);
        if (t) competitorApps.push(t);
      }
    }
  } catch (_e) { /* soft signal — ok to skip */ }
  try {
    const kw = await dfsPost<{ tasks?: Array<{ result?: Record<string, unknown>[] }> }>(
      "dataforseo_labs/google/app_keywords/live",
      [{ app_id: appId, location_name: LOCATION_NAME, language_name: languageName, limit: 50 }],
    );
    for (const res of firstResult<Record<string, unknown>>(kw)) {
      for (const it of (res.items as Record<string, unknown>[] | undefined) ?? []) {
        const k = readString(it.keyword) ?? readString((it.keyword_data as Record<string, unknown>)?.keyword);
        if (k) keywords.push(k);
      }
    }
  } catch (_e) { /* soft signal — ok to skip */ }
  return { competitorApps: competitorApps.slice(0, 20), keywords: keywords.slice(0, 50) };
}

// ── tiny readers (defensive — DataForSEO field names vary by product) ──────────
function readString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
function readNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function readRating(item: Record<string, unknown>): number | null {
  const r = item.rating;
  if (typeof r === "number") return r;
  if (r && typeof r === "object") {
    const val = (r as Record<string, unknown>).value;
    if (typeof val === "number") return val;
  }
  return null;
}
function readStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x : readString((x as Record<string, unknown>)?.name))).filter(
    (x): x is string => !!x,
  );
}
