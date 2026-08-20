import "server-only";
// @ts-ignore JSDOM used for safe HTML parsing only (no script execution)
import { JSDOM } from "jsdom";
import { safeFetchDomain, type SafeFetchResult } from "./brand-detection";

/**
 * Brand Market Extraction — Step 3 (Deterministic Signal Extraction)
 *
 * Continues directly from Step 2's safe-fetched homepage.
 * Extracts:
 * 1. Brand candidates from structured metadata
 * 2. Market/country candidates from multi-layered signals
 * 3. Evidence and source URLs for each signal
 *
 * Zero-cost deterministic extraction: no AI, no LLM, no agents, no paid APIs.
 * Multi-country first: one brand can operate in many markets (returned independently).
 * Security contract: reuses Step 2's safe transport for any secondary pages.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type SignalStrength = "strong" | "medium" | "weak";

export interface BrandSignal {
  candidate_field: string; // e.g., "og:site_name", "organization.name"
  candidate_value: string;
  signal_type: "structured_metadata" | "page_title" | "domain_derived";
  signal_strength: SignalStrength;
  source_url: string;
  source_location: string; // e.g., "OpenGraph meta tag", "JSON-LD Organization"
  extracted_value_or_excerpt: string;
  extractor_id: string; // e.g., "og_site_name", "json_ld_organization", "domain_fallback"
}

export interface BrandCandidate {
  brand_name: string;
  signals: BrandSignal[];
  canonical_domain: string;
  final_resolved_domain: string;
  logo_candidates: string[];
  favicon_candidates: string[];
}

export type MarketSignalType =
  | "gaming_licence"
  | "explicit_operating_statement"
  | "country_specific_terms"
  | "local_legal_entity"
  | "country_selector"
  | "market_specific_path"
  | "market_specific_subdomain"
  | "hreflang_region"
  | "local_currency"
  | "country_phone_code"
  | "local_payment_method"
  | "language"
  | "ccTLD"
  | "generic_country_mention";

export interface MarketSignal {
  signal_type: MarketSignalType;
  signal_strength: SignalStrength;
  detected_value: string; // e.g., "KE" or "Kenya" or "KES"
  source_url: string;
  source_location: string; // e.g., "country selector dropdown", "hreflang tag"
  extracted_value_or_excerpt: string;
  extractor_id: string;
}

export interface MarketCandidate {
  market_code: string; // ISO 3166-1 alpha-2, e.g., "KE", "TZ", "ZM"
  market_name: string; // e.g., "Kenya", "Tanzania", "Zambia"
  signals: MarketSignal[];
  source_urls: string[]; // URLs where evidence was found
  lifecycle_state: "detected"; // Always "detected" at Step 3 (never confirmed/tracked)
  market_specific_url?: string;
  market_specific_domain?: string;
  market_specific_subdomain?: string;
  market_specific_path?: string;
}

export interface UnsupportedMarketEvidence {
  country_code: string;
  country_name: string;
  signals: MarketSignal[];
  source_urls: string[];
  reason: "country_not_in_brandscope_registry";
}

export interface DetectedBrandAndMarkets {
  ok: true;
  brand_candidates: BrandCandidate[];
  selected_brand?: BrandCandidate; // Only if deterministic precedence is clear
  detected_markets: MarketCandidate[];
  unsupported_market_evidence: UnsupportedMarketEvidence[];
  extraction_metadata: {
    homepage_url: string;
    final_resolved_url: string;
    secondary_pages_used: string[];
    extraction_timestamp: string;
  };
}

export interface DetectionFailure {
  ok: false;
  error: string;
  detail?: string;
}

export type BrandAndMarketExtractionResult =
  | DetectedBrandAndMarkets
  | DetectionFailure;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Supported country codes and market names. */
const SUPPORTED_MARKETS: Record<string, string> = {
  KE: "Kenya",
  TZ: "Tanzania",
  ZM: "Zambia",
  NG: "Nigeria",
  ZA: "South Africa",
};

/** Map country codes to phone dial codes. */
const COUNTRY_PHONE_CODES: Record<string, string[]> = {
  KE: ["+254", "254"],
  TZ: ["+255", "255"],
  ZM: ["+260", "260"],
  NG: ["+234", "234"],
  ZA: ["+27", "27"],
};

/** Map country codes to currency codes. */
const COUNTRY_CURRENCIES: Record<string, string[]> = {
  KE: ["KES"],
  TZ: ["TZS"],
  ZM: ["ZMW"],
  NG: ["NGN"],
  ZA: ["ZAR"],
};

/** Country code to ccTLD mapping. */
const COUNTRY_CCTLDS: Record<string, string[]> = {
  KE: [".ke"],
  TZ: [".tz"],
  ZM: [".zm"],
  NG: [".ng"],
  ZA: [".za"],
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely parse JSON-LD from script tags.
 * Handles multiple blocks, @graph, malformed JSON, and missing elements.
 */
function extractJsonLd(dom: JSDOM): Record<string, any>[] {
  const scripts = dom.window.document.querySelectorAll('script[type="application/ld+json"]');
  const results: Record<string, any>[] = [];

  for (const script of scripts) {
    try {
      const json = JSON.parse(script.textContent || "");
      if (json) {
        if (Array.isArray(json)) {
          results.push(...json);
        } else if (json["@graph"]) {
          results.push(...json["@graph"]);
        } else {
          results.push(json);
        }
      }
    } catch (e) {
      // Silently skip malformed JSON-LD
    }
  }

  return results;
}

/**
 * Extract OpenGraph meta tags.
 */
function extractOpenGraph(dom: JSDOM): Record<string, string> {
  const og: Record<string, string> = {};
  const metas = dom.window.document.querySelectorAll("meta[property^='og:']");

  for (const meta of metas) {
    const property = meta.getAttribute("property");
    const content = meta.getAttribute("content");
    if (property && content) {
      // Handle duplicates: keep first occurrence
      if (!og[property]) {
        og[property] = content;
      }
    }
  }

  return og;
}

/**
 * Normalize whitespace and decode HTML entities.
 */
function normalizeText(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract hostname from URL.
 */
function getHostname(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    return "";
  }
}

/**
 * Extract path from URL.
 */
function getPath(urlString: string): string {
  try {
    const url = new URL(urlString);
    return url.pathname;
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BRAND EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract brand candidates from structured metadata and page title.
 */
function extractBrandCandidates(
  dom: JSDOM,
  finalUrl: string,
  normalizedDomain: string,
): BrandCandidate[] {
  const signals: BrandSignal[] = [];
  const brandNames = new Set<string>();

  // 1. Extract JSON-LD Organization/WebSite (strong signals)
  const jsonLdItems = extractJsonLd(dom);

  for (const item of jsonLdItems) {
    if (item["@type"] === "Organization" && item.name) {
      const name = normalizeText(item.name);
      brandNames.add(name);
      signals.push({
        candidate_field: "@type Organization.name",
        candidate_value: name,
        signal_type: "structured_metadata",
        signal_strength: "strong",
        source_url: finalUrl,
        source_location: "JSON-LD Organization schema",
        extracted_value_or_excerpt: name,
        extractor_id: "json_ld_organization",
      });
    }

    if (item["@type"] === "WebSite" && item.name) {
      const name = normalizeText(item.name);
      brandNames.add(name);
      signals.push({
        candidate_field: "@type WebSite.name",
        candidate_value: name,
        signal_type: "structured_metadata",
        signal_strength: "strong",
        source_url: finalUrl,
        source_location: "JSON-LD WebSite schema",
        extracted_value_or_excerpt: name,
        extractor_id: "json_ld_website",
      });
    }
  }

  // 2. Extract OpenGraph site name (strong signal)
  const og = extractOpenGraph(dom);
  if (og["og:site_name"]) {
    const name = normalizeText(og["og:site_name"]);
    brandNames.add(name);
    signals.push({
      candidate_field: "og:site_name",
      candidate_value: name,
      signal_type: "structured_metadata",
      signal_strength: "strong",
      source_url: finalUrl,
      source_location: 'OpenGraph <meta property="og:site_name">',
      extracted_value_or_excerpt: name,
      extractor_id: "og_site_name",
    });
  }

  // 3. Extract application-name (medium signal)
  const appNameMeta = dom.window.document.querySelector('meta[name="application-name"]');
  if (appNameMeta) {
    const name = normalizeText(appNameMeta.getAttribute("content") || "");
    if (name) {
      brandNames.add(name);
      signals.push({
        candidate_field: "application-name",
        candidate_value: name,
        signal_type: "structured_metadata",
        signal_strength: "medium",
        source_url: finalUrl,
        source_location: '<meta name="application-name">',
        extracted_value_or_excerpt: name,
        extractor_id: "application_name",
      });
    }
  }

  // 4. Extract page title (medium signal)
  const title = dom.window.document.title;
  if (title) {
    const normalizedTitle = normalizeText(title);
    // Only extract the first part before common separators
    const titlePart = normalizedTitle.split(/[\-|–—•·]/)[0].trim();
    if (titlePart && titlePart.length > 2 && titlePart.length < 100) {
      brandNames.add(titlePart);
      signals.push({
        candidate_field: "document.title",
        candidate_value: titlePart,
        signal_type: "page_title",
        signal_strength: "medium",
        source_url: finalUrl,
        source_location: "<title> tag",
        extracted_value_or_excerpt: titlePart,
        extractor_id: "page_title",
      });
    }
  }

  // 5. Extract domain-derived name (weak signal - fallback only)
  const domainName = normalizedDomain.split(".")[0]?.toUpperCase() || normalizedDomain;
  if (domainName) {
    signals.push({
      candidate_field: "domain",
      candidate_value: domainName,
      signal_type: "domain_derived",
      signal_strength: "weak",
      source_url: finalUrl,
      source_location: "domain name (fallback)",
      extracted_value_or_excerpt: domainName,
      extractor_id: "domain_fallback",
    });
  }

  // Extract logo and favicon candidates
  const logoCandidates = extractLogoCandidates(dom, finalUrl);
  const faviconCandidates = extractFaviconCandidates(dom, finalUrl);

  // Create brand candidates
  const candidates: BrandCandidate[] = Array.from(brandNames).map((name) => ({
    brand_name: name,
    signals: signals.filter((s) => s.candidate_value === name),
    canonical_domain: normalizedDomain,
    final_resolved_domain: getHostname(finalUrl),
    logo_candidates: logoCandidates,
    favicon_candidates: faviconCandidates,
  }));

  // Always include domain fallback if no structured signals found
  if (candidates.length === 0) {
    candidates.push({
      brand_name: domainName,
      signals: signals.filter((s) => s.extractor_id === "domain_fallback"),
      canonical_domain: normalizedDomain,
      final_resolved_domain: getHostname(finalUrl),
      logo_candidates: logoCandidates,
      favicon_candidates: faviconCandidates,
    });
  }

  return candidates;
}

function extractLogoCandidates(dom: JSDOM, baseUrl: string): string[] {
  const logos = new Set<string>();

  // og:image as logo
  const metas = dom.window.document.querySelectorAll("meta[property='og:image']");
  for (const meta of metas) {
    const content = meta.getAttribute("content");
    if (content) logos.add(content);
  }

  // Logo link relations
  const logoLinks = dom.window.document.querySelectorAll('link[rel*="logo"]');
  for (const link of logoLinks) {
    const href = link.getAttribute("href");
    if (href) logos.add(href);
  }

  return Array.from(logos);
}

function extractFaviconCandidates(dom: JSDOM, baseUrl: string): string[] {
  const favicons = new Set<string>();

  // Standard favicon
  const iconLinks = dom.window.document.querySelectorAll('link[rel*="icon"]');
  for (const link of iconLinks) {
    const href = link.getAttribute("href");
    if (href) favicons.add(href);
  }

  // Fallback
  favicons.add("/favicon.ico");

  return Array.from(favicons);
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKET EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract market/country candidates from multi-layered signals.
 */
function extractMarketCandidates(dom: JSDOM, finalUrl: string): MarketCandidate[] {
  const marketMap = new Map<string, MarketCandidate>();

  // 1. Extract strong signals
  extractCountrySelectorsStrong(dom, finalUrl, marketMap);
  extractCountrySpecificTermsStrong(dom, finalUrl, marketMap);
  extractLicenceSignals(dom, finalUrl, marketMap);

  // 2. Extract medium signals
  extractCountrySpecificPaths(finalUrl, marketMap);
  extractCountrySpecificSubdomains(finalUrl, marketMap);
  extractHreflangRegions(dom, finalUrl, marketMap);
  extractLocalCurrencies(dom, finalUrl, marketMap);
  extractCountryPhoneCodes(dom, finalUrl, marketMap);

  // 3. Extract weak signals
  extractWeakSignals(dom, finalUrl, marketMap);

  // 4. Filter markets by eligibility: prevent weak-signal-only false positives
  return filterMarketsByEligibility(Array.from(marketMap.values()));
}

/**
 * Eligibility gate: only allow markets with sufficient evidence to be detected.
 *
 * Rules (P1 - Market Eligibility):
 * - Currency alone (medium) → NOT eligible
 * - hreflang alone (medium) → NOT eligible
 * - Phone code alone (medium) → NOT eligible
 * - ccTLD alone (weak) → NOT eligible
 * - Generic mentions alone (weak) → NOT eligible
 *
 * Eligible if:
 * - At least 1 strong signal (licence, explicit statement, country-specific terms, selector)
 * - OR at least 2 medium signals from different types
 *
 * Weak/medium signals can remain as corroborating evidence even if ineligible.
 */
function filterMarketsByEligibility(markets: MarketCandidate[]): MarketCandidate[] {
  return markets.filter((market) => {
    const signals = market.signals;

    // Count signals by strength
    const strongSignals = signals.filter((s) => s.signal_strength === "strong");
    const mediumSignals = signals.filter((s) => s.signal_strength === "medium");
    const weakSignals = signals.filter((s) => s.signal_strength === "weak");

    // Rule: at least 1 strong signal makes market eligible
    if (strongSignals.length > 0) {
      return true;
    }

    // Rule: at least 2 different types of medium signals makes market eligible
    if (mediumSignals.length >= 2) {
      // Check they're different types (not just 2x same signal type)
      const mediumTypes = new Set(mediumSignals.map((s) => s.signal_type));
      if (mediumTypes.size >= 2) {
        return true;
      }
    }

    // Rule: weak/medium-only signals → NOT eligible as detected market
    // (but signals are retained for future Step 4 scoring/ambiguity resolution)
    return false;
  });
}

function extractCountrySelectorsStrong(
  dom: JSDOM,
  finalUrl: string,
  marketMap: Map<string, MarketCandidate>,
): void {
  // Look for select elements with country options
  const selects = dom.window.document.querySelectorAll("select");
  for (const select of selects) {
    const selectName = select.name?.toLowerCase() || "";
    const selectId = select.id?.toLowerCase() || "";

    // Check if this looks like a country/market selector
    if (
      selectName.includes("country") ||
      selectName.includes("market") ||
      selectName.includes("region") ||
      selectId.includes("country") ||
      selectId.includes("market") ||
      selectId.includes("region")
    ) {
      const options = select.querySelectorAll("option");
      for (const option of options) {
        const text = option.textContent?.trim() || "";
        const value = option.value?.trim() || "";

        // Try to match against known countries
        for (const [code, name] of Object.entries(SUPPORTED_MARKETS)) {
          if (
            text.toLowerCase().includes(code.toLowerCase()) ||
            text.toLowerCase().includes(name.toLowerCase()) ||
            value.toLowerCase().includes(code.toLowerCase())
          ) {
            addMarketSignal(
              marketMap,
              code,
              "country_selector",
              "strong",
              code,
              finalUrl,
              "Country selector dropdown",
              text,
              "country_selector",
            );
          }
        }
      }
    }
  }
}

function extractCountrySpecificTermsStrong(
  dom: JSDOM,
  finalUrl: string,
  marketMap: Map<string, MarketCandidate>,
): void {
  const bodyText = dom.window.document.body.textContent || "";

  // Look for country-specific terms like "Kenya Terms & Conditions", "Tanzania Responsible Gaming"
  for (const [code, name] of Object.entries(SUPPORTED_MARKETS)) {
    const patterns = [
      new RegExp(`${name}\\s+(Terms|Conditions|Responsible Gaming|Policy)`, "i"),
      new RegExp(`${name}\\s+(Privacy|License|Licence)`, "i"),
      new RegExp(`We\\s+operate\\s+in\\s+${name}`, "i"),
    ];

    for (const pattern of patterns) {
      if (pattern.test(bodyText)) {
        addMarketSignal(
          marketMap,
          code,
          "country_specific_terms",
          "strong",
          code,
          finalUrl,
          `Country-specific terms found for ${name}`,
          name,
          "country_specific_terms",
        );
      }
    }
  }
}

function extractLicenceSignals(
  dom: JSDOM,
  finalUrl: string,
  marketMap: Map<string, MarketCandidate>,
): void {
  const bodyText = dom.window.document.body.textContent || "";

  // Look for licence/regulator references
  const licencePatterns: Record<string, string> = {
    KE: "Gaming Board|Gaming Authority|Kenya Gaming",
    TZ: "Tanzania Gaming|SUMATRA|Gaming Commission",
    ZM: "Zambia Gaming|ZCCRS",
    NG: "National Lottery|FIRS|NLA",
    ZA: "National Gambling Board|Gambling Board",
  };

  for (const [code, pattern] of Object.entries(licencePatterns)) {
    const regex = new RegExp(pattern, "i");
    if (regex.test(bodyText)) {
      addMarketSignal(
        marketMap,
        code,
        "gaming_licence",
        "strong",
        code,
        finalUrl,
        "Gaming licence/regulator reference",
        code,
        "gaming_licence",
      );
    }
  }
}

function extractCountrySpecificPaths(finalUrl: string, marketMap: Map<string, MarketCandidate>): void {
  const path = getPath(finalUrl);

  // Look for market-specific paths like /ke, /tz, /zm, /ng, /za
  for (const code of Object.keys(SUPPORTED_MARKETS)) {
    if (path.toLowerCase().includes(`/${code.toLowerCase()}`) ||
        path.toLowerCase().includes(`/${code.toLowerCase()}/`)) {
      addMarketSignal(
        marketMap,
        code,
        "market_specific_path",
        "medium",
        code,
        finalUrl,
        `Market-specific path: /${code}`,
        `/${code}`,
        "market_specific_path",
      );
      if (!marketMap.get(code)?.market_specific_path) {
        const candidate = marketMap.get(code);
        if (candidate) candidate.market_specific_path = `/${code}`;
      }
    }
  }
}

function extractCountrySpecificSubdomains(
  finalUrl: string,
  marketMap: Map<string, MarketCandidate>,
): void {
  const hostname = getHostname(finalUrl);

  // Look for market-specific subdomains like ke.brand.com, tz.brand.com
  for (const code of Object.keys(SUPPORTED_MARKETS)) {
    if (hostname.startsWith(`${code.toLowerCase()}.`)) {
      addMarketSignal(
        marketMap,
        code,
        "market_specific_subdomain",
        "medium",
        code,
        finalUrl,
        `Market-specific subdomain`,
        `${code}.`,
        "market_specific_subdomain",
      );
      if (!marketMap.get(code)?.market_specific_subdomain) {
        const candidate = marketMap.get(code);
        if (candidate) candidate.market_specific_subdomain = `${code}.`;
      }
    }
  }
}

function extractHreflangRegions(dom: JSDOM, finalUrl: string, marketMap: Map<string, MarketCandidate>): void {
  const hreflangs = dom.window.document.querySelectorAll('link[rel="alternate"][hreflang]');

  for (const link of hreflangs) {
    const hreflang = link.getAttribute("hreflang") || "";
    const href = link.getAttribute("href") || "";

    // Parse hreflang: en-KE, en-TZ, sw-TZ, etc.
    const parts = hreflang.split("-");
    if (parts.length === 2) {
      const code = parts[1].toUpperCase();
      if (SUPPORTED_MARKETS[code]) {
        addMarketSignal(
          marketMap,
          code,
          "hreflang_region",
          "medium",
          code,
          href || finalUrl,
          `hreflang link with region`,
          hreflang,
          "hreflang_region",
        );
      }
    }
  }
}

function extractLocalCurrencies(dom: JSDOM, finalUrl: string, marketMap: Map<string, MarketCandidate>): void {
  const bodyText = dom.window.document.body.textContent || "";

  for (const [code, currencies] of Object.entries(COUNTRY_CURRENCIES)) {
    for (const currency of currencies) {
      // Look for currency code patterns like "KES", "TZS", etc.
      if (new RegExp(`\\b${currency}\\b`, "i").test(bodyText)) {
        addMarketSignal(
          marketMap,
          code,
          "local_currency",
          "medium",
          code,
          finalUrl,
          `Local currency found: ${currency}`,
          currency,
          "local_currency",
        );
      }
    }
  }
}

function extractCountryPhoneCodes(dom: JSDOM, finalUrl: string, marketMap: Map<string, MarketCandidate>): void {
  const bodyText = dom.window.document.body.textContent || "";

  for (const [code, phoneCodes] of Object.entries(COUNTRY_PHONE_CODES)) {
    for (const phoneCode of phoneCodes) {
      // Look for phone code patterns
      if (new RegExp(`[+\\s]${phoneCode}[\\s-]`, "g").test(bodyText)) {
        addMarketSignal(
          marketMap,
          code,
          "country_phone_code",
          "medium",
          code,
          finalUrl,
          `Country phone code found: ${phoneCode}`,
          phoneCode,
          "country_phone_code",
        );
      }
    }
  }
}

function extractWeakSignals(dom: JSDOM, finalUrl: string, marketMap: Map<string, MarketCandidate>): void {
  const bodyText = dom.window.document.body.textContent || "";
  const hostname = getHostname(finalUrl);

  // Check for ccTLD
  for (const [code, cctlds] of Object.entries(COUNTRY_CCTLDS)) {
    for (const cctld of cctlds) {
      if (hostname.endsWith(cctld)) {
        addMarketSignal(
          marketMap,
          code,
          "ccTLD",
          "weak",
          code,
          finalUrl,
          `Country code TLD found`,
          cctld,
          "cctld",
        );
      }
    }
  }

  // Check for generic country mentions (very weak)
  for (const [code, name] of Object.entries(SUPPORTED_MARKETS)) {
    const mentions = (bodyText.match(new RegExp(`\\b${name}\\b`, "gi")) || []).length;
    if (mentions > 3) {
      // Only if mentioned multiple times
      addMarketSignal(
        marketMap,
        code,
        "generic_country_mention",
        "weak",
        code,
        finalUrl,
        `Country name mentioned multiple times`,
        name,
        "generic_country_mention",
      );
    }
  }
}

function addMarketSignal(
  marketMap: Map<string, MarketCandidate>,
  code: string,
  signalType: MarketSignalType,
  strength: SignalStrength,
  detectedValue: string,
  sourceUrl: string,
  sourceLocation: string,
  excerpt: string,
  extractorId: string,
): void {
  const name = SUPPORTED_MARKETS[code];
  if (!name) return;

  if (!marketMap.has(code)) {
    marketMap.set(code, {
      market_code: code,
      market_name: name,
      signals: [],
      source_urls: [sourceUrl],
      lifecycle_state: "detected",
    });
  }

  const candidate = marketMap.get(code)!;
  candidate.signals.push({
    signal_type: signalType,
    signal_strength: strength,
    detected_value: detectedValue,
    source_url: sourceUrl,
    source_location: sourceLocation,
    extracted_value_or_excerpt: excerpt,
    extractor_id: extractorId,
  });

  // Add source URL if not already present
  if (!candidate.source_urls.includes(sourceUrl)) {
    candidate.source_urls.push(sourceUrl);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECONDARY PAGE DECISION LOGIC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine if homepage evidence is sufficient.
 * Returns true if at least one market is detected with sufficient evidence.
 */
function isHomepageEvidenceSufficient(markets: MarketCandidate[]): boolean {
  return markets.length > 0;
}

/**
 * Discover and select secondary pages from homepage links.
 *
 * Strategy:
 * 1. Parse all <a> tags from the homepage
 * 2. Score links by keyword relevance (Terms, Legal, Licence, Responsible Gaming, etc.)
 * 3. Select up to 3 highest-scoring same-origin links
 * 4. Fallback: only if no links found, try conventional paths
 *
 * This avoids unnecessary 404s and discovers actual site structure.
 */
function selectSecondaryPagesToFetch(dom: JSDOM, baseUrl: string): string[] {
  const baseHostname = new URL(baseUrl).hostname;
  const relevantKeywords = [
    "terms",
    "legal",
    "licence",
    "license",
    "responsible",
    "gaming",
    "play",
    "compliance",
    "about",
    "contact",
    "regulatory",
    "company",
  ];

  // Step 1: Discover links from homepage
  const links: Array<{ url: string; score: number }> = [];

  const anchors = dom.window.document.querySelectorAll("a[href]");
  for (const anchor of anchors) {
    const href = anchor.getAttribute("href");
    if (!href) continue;

    // Parse href (handle relative, absolute, fragments)
    let url: URL;
    try {
      url = new URL(href, baseUrl);
    } catch {
      continue;
    }

    // Same-origin only (no external links)
    if (url.hostname !== baseHostname) continue;

    // Avoid fragments, query-only URLs
    if (!url.pathname || url.pathname === "/") continue;

    // Score based on text content + href + aria-label
    let score = 0;
    const linkText = (anchor.textContent || "").toLowerCase();
    const hrefLower = url.pathname.toLowerCase();
    const ariaLabel = (anchor.getAttribute("aria-label") || "").toLowerCase();
    const combinedText = `${linkText} ${hrefLower} ${ariaLabel}`;

    for (const keyword of relevantKeywords) {
      if (combinedText.includes(keyword)) {
        score += 10; // Strong match in text/label/href
      }
    }

    if (score > 0) {
      links.push({ url: url.toString(), score });
    }
  }

  // Step 2: Select top-scoring links (deduplicate, max 3)
  const deduped = new Map<string, number>();
  for (const { url, score } of links) {
    // Normalize: remove trailing slash, query, fragment
    const normalized = new URL(url).pathname.toLowerCase();
    if (!deduped.has(normalized) || deduped.get(normalized)! < score) {
      deduped.set(normalized, score);
    }
  }

  const selected = Array.from(deduped.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([path]) => {
      try {
        const url = new URL(baseUrl);
        url.pathname = path;
        return url.toString();
      } catch {
        return "";
      }
    })
    .filter((url) => url);

  // Step 3: Fallback to conventional paths only if no links discovered
  if (selected.length === 0) {
    const base = new URL(baseUrl);
    const hostname = base.hostname;
    const fallbackPaths = ["/legal", "/terms", "/responsible-gaming", "/about", "/compliance"];

    for (const path of fallbackPaths) {
      if (selected.length >= 3) break;
      selected.push(`https://${hostname}${path}`);
    }
  }

  return selected;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXTRACTION PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main entry point for brand + market extraction.
 * Continues directly from Step 2's safe-fetched homepage.
 *
 * Pipeline:
 * 1. Fetch homepage via Step 2 (safeFetchDomain)
 * 2. Extract brand + market candidates from homepage
 * 3. If evidence insufficient, fetch up to 3 secondary pages (terms, legal, about)
 * 4. Merge evidence from all pages
 * 5. Return brand + market candidates with evidence
 *
 * Security: all fetches use Step 2's safe transport (SSRF-protected, redirects validated, size-limited)
 * No homepage refetch: homepage fetched once, secondary pages only if needed
 *
 * @param domain User's input domain (will be validated/fetched via Step 2)
 * @returns Brand and market candidates with evidence
 */
export async function extractBrandAndMarkets(
  domain: string,
): Promise<BrandAndMarketExtractionResult> {
  try {
    // STEP 1: Fetch homepage via Step 2 safe-fetch
    const fetchResult = await safeFetchDomain(domain);

    if (!fetchResult.ok) {
      return {
        ok: false,
        error: fetchResult.error,
        detail: fetchResult.detail,
      };
    }

    // STEP 2: Parse homepage HTML
    const dom = new JSDOM(fetchResult.body, {
      url: domain,
      pretendToBeVisual: true,
    });

    const finalUrl = domain;
    const normalizedDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];

    // STEP 3: Extract from homepage
    const brandCandidates = extractBrandCandidates(dom, finalUrl, normalizedDomain);
    let marketCandidates = extractMarketCandidates(dom, finalUrl);
    const secondaryPagesUsed: string[] = [];

    // STEP 4: Check if homepage evidence is sufficient
    if (!isHomepageEvidenceSufficient(marketCandidates)) {
      // Discover secondary pages from homepage links or fallback to conventional paths
      const secondaryUrls = selectSecondaryPagesToFetch(dom, domain);

      for (const secondaryUrl of secondaryUrls) {
        if (secondaryPagesUsed.length >= 3) break;

        // Fetch secondary page via Step 2 safe transport
        const secondaryResult = await safeFetchDomain(secondaryUrl);

        if (secondaryResult.ok) {
          const secondaryDom = new JSDOM(secondaryResult.body, {
            url: secondaryUrl,
            pretendToBeVisual: true,
          });

          // Extract market signals from secondary page
          const secondaryMarkets = extractMarketCandidates(secondaryDom, secondaryUrl);

          // Merge with existing markets
          for (const newMarket of secondaryMarkets) {
            const existing = marketCandidates.find((m) => m.market_code === newMarket.market_code);
            if (existing) {
              // Merge signals and source URLs
              existing.signals.push(...newMarket.signals);
              for (const url of newMarket.source_urls) {
                if (!existing.source_urls.includes(url)) {
                  existing.source_urls.push(url);
                }
              }
            } else {
              // Add new market
              marketCandidates.push(newMarket);
            }
          }

          secondaryPagesUsed.push(secondaryUrl);
        }
      }
    }

    // STEP 5: Separate unsupported markets
    const unsupportedMarkets: UnsupportedMarketEvidence[] = [];
    const detectedMarkets = marketCandidates.filter((m) => {
      if (!SUPPORTED_MARKETS[m.market_code]) {
        unsupportedMarkets.push({
          country_code: m.market_code,
          country_name: m.market_name,
          signals: m.signals,
          source_urls: m.source_urls,
          reason: "country_not_in_brandscope_registry",
        });
        return false;
      }
      return true;
    });

    return {
      ok: true,
      brand_candidates: brandCandidates,
      detected_markets: detectedMarkets,
      unsupported_market_evidence: unsupportedMarkets,
      extraction_metadata: {
        homepage_url: domain,
        final_resolved_url: finalUrl,
        secondary_pages_used: secondaryPagesUsed,
        extraction_timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: "extraction_error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
