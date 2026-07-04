// generate-market-maps.mjs — regenerates the edge-function market literals from
// lib/onboarding/countries.ts (the single source of truth). Run after ANY change
// to the country list, then redeploy: onboarding-suggest + the researchers that
// resolve locations (traffic-seo, geo-aeo, promotions, customer).
//
//   node scripts/generate-market-maps.mjs
//
// It verifies invariants first (frozen legacy slugs, known Google location codes)
// and rewrites the generated blocks in:
//   supabase/functions/_shared/dataforseo.ts      (MARKET_LOCATION)
//   supabase/functions/onboarding-suggest/index.ts (ALLOWED_MARKETS)

import { readFileSync, writeFileSync } from "node:fs";

// countries.ts is TypeScript — transpile-lite by stripping types via tsx-less
// trick: evaluate through a temp esbuild-free path. Simplest robust approach:
// let tsc emit nothing and parse the RAW tuples with a regex instead.
const src = readFileSync("lib/onboarding/countries.ts", "utf8");

const tupleRe = /\["([A-Z]{2})",\s*(\d+),\s*"([^"]+)",\s*"([^"]+)"\]/g;
const rows = [];
for (const m of src.matchAll(tupleRe)) {
  rows.push({ iso2: m[1], num: Number(m[2]), label: m[3], region: m[4] });
}
if (rows.length < 190) {
  throw new Error(`parsed only ${rows.length} countries — regex drift?`);
}

// Mirror slugifyMarket() exactly.
function slug(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ── invariant 1: the 40 legacy slugs are frozen (stored in brands.market) ────
const LEGACY = [
  "nigeria","ghana","senegal","cote_divoire","benin","burkina_faso","mali",
  "niger","togo","sierra_leone","liberia","gambia","guinea","cape_verde",
  "kenya","uganda","tanzania","rwanda","burundi","ethiopia","south_africa",
  "zambia","zimbabwe","malawi","mozambique","botswana","namibia","lesotho",
  "eswatini","angola","cameroon","dr_congo","congo_republic","gabon","chad",
  "mauritius","madagascar","seychelles","morocco","tunisia",
];
const slugs = new Set(rows.map((r) => slug(r.label)));
const missing = LEGACY.filter((s) => !slugs.has(s));
if (missing.length) throw new Error(`legacy slugs missing/renamed: ${missing.join(", ")}`);
if (slugs.size !== rows.length) {
  const seen = new Set(); const dupes = [];
  for (const r of rows) { const s = slug(r.label); if (seen.has(s)) dupes.push(s); seen.add(s); }
  throw new Error(`duplicate slugs: ${dupes.join(", ")}`);
}

// ── invariant 2: spot-check location codes against known Google criteria IDs ─
const KNOWN = { nigeria: 2566, kenya: 2404, south_africa: 2710, united_states: 2840,
  united_kingdom: 2826, france: 2250, germany: 2276, brazil: 2076, india: 2356,
  japan: 2392, australia: 2036, ghana: 2288, canada: 2124 };
for (const [s, code] of Object.entries(KNOWN)) {
  const row = rows.find((r) => slug(r.label) === s);
  if (!row || 2000 + row.num !== code) {
    throw new Error(`location code mismatch for ${s}: got ${row ? 2000 + row.num : "missing"}, want ${code}`);
  }
}

// ── emit MARKET_LOCATION into _shared/dataforseo.ts ──────────────────────────
const locLines = rows
  .map((r) => `  ${slug(r.label)}: ${2000 + r.num},`)
  .join("\n");
const locBlock = `// ── Market → DataForSEO Google location_code ──────────────────────────────────
// GENERATED from lib/onboarding/countries.ts by scripts/generate-market-maps.mjs
// — do not edit by hand. Keys are brands.market slugs; codes are Google geotarget
// country criteria IDs (2000 + ISO 3166-1 numeric). Default Nigeria (launch market).
export const MARKET_LOCATION: Record<string, number> = {
${locLines}
};`;

const dfsPath = "supabase/functions/_shared/dataforseo.ts";
let dfs = readFileSync(dfsPath, "utf8");
const dfsRe = /\/\/ ── Market → DataForSEO Google location_code ─+[\s\S]*?\nexport const MARKET_LOCATION: Record<string, number> = \{[\s\S]*?\n\};/;
if (!dfsRe.test(dfs)) throw new Error("MARKET_LOCATION block not found in dataforseo.ts");
dfs = dfs.replace(dfsRe, locBlock);
writeFileSync(dfsPath, dfs);

// ── emit ALLOWED_MARKETS into onboarding-suggest/index.ts ────────────────────
const allowedLines = rows
  .map((r) => `  ${slug(r.label)}: ${JSON.stringify(r.label)},`)
  .join("\n");
const allowedBlock = `// Supported market values — GENERATED from lib/onboarding/countries.ts by
// scripts/generate-market-maps.mjs; do not edit by hand.
const ALLOWED_MARKETS: Record<string, string> = {
${allowedLines}
};`;

const obPath = "supabase/functions/onboarding-suggest/index.ts";
let ob = readFileSync(obPath, "utf8");
const obRe = /\/\/ Supported market values —[\s\S]*?\nconst ALLOWED_MARKETS: Record<string, string> = \{[\s\S]*?\n\};/;
if (!obRe.test(ob)) throw new Error("ALLOWED_MARKETS block not found in onboarding-suggest");
ob = ob.replace(obRe, allowedBlock);
writeFileSync(obPath, ob);

console.log(`ok: ${rows.length} countries → MARKET_LOCATION + ALLOWED_MARKETS regenerated`);
