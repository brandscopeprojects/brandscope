// GEO / AEO / SEO Visibility — Screen 14 (/geo-aeo-seo).
// How visible the brand is across AI answer engines. Reads the per-brand
// geo_cache (DataForSEO AI Optimization), 4 MVP platforms only (ChatGPT, Claude,
// Gemini, Perplexity; Grok/Meta = Phase 2, hidden — mvp-constraints §2).
// Pre-first-scan → honest EmptyState, never fabricated numbers (CLAUDE.md).

import { getCurrentBrand, getGeoData } from "@/lib/data/geo";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { GeoAIVisibilityScore } from "@/components/intelligence/GeoAIVisibilityScore";
import { GeoPlatformBreakdownTable } from "@/components/intelligence/GeoPlatformBreakdownTable";
import { GeoCompetitorScores } from "@/components/intelligence/GeoCompetitorScores";
import { GeoEvidenceList } from "@/components/intelligence/GeoEvidenceList";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "How visible your brand is across AI answer engines — ChatGPT, Claude, Gemini and Perplexity.";

export default async function GeoAeoSeoPage() {
  const brand = await getCurrentBrand();
  const geo = brand ? await getGeoData(brand) : null;

  if (!brand || !geo) {
    return (
      <div className="space-y-6">
        <PageHeader title="GEO / AEO / SEO Visibility" subtitle={SUBTITLE} />
        <EmptyState
          title="No AI visibility data yet"
          message="Your first scan will measure how often AI assistants mention your brand (DataForSEO AI Optimization)."
          intent="scanning"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="GEO / AEO / SEO Visibility"
        subtitle={SUBTITLE}
        scanWeek={geo.scanWeek}
      />

      <GeoAIVisibilityScore score={geo.score} trend={geo.scoreChangeWow} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Platform breakdown</h2>
        <GeoPlatformBreakdownTable rows={geo.platforms} />
      </section>

      {geo.competitorScores.length > 0 && (
        <GeoCompetitorScores
          brandName={brand.name}
          brandScore={geo.score}
          competitors={geo.competitorScores}
        />
      )}

      {geo.topMentions.length > 0 && (
        <GeoEvidenceList
          title="Notable AI mentions"
          items={geo.topMentions.map((m) => ({
            label: m.platform,
            url: m.url,
            snippet: m.snippet,
          }))}
        />
      )}

      {geo.featuredSnippets.length > 0 && (
        <GeoEvidenceList
          title="Featured snippets feeding AI answers"
          items={geo.featuredSnippets.map((s) => ({
            label: s.query,
            url: s.url,
            snippet: s.snippet,
          }))}
        />
      )}
    </div>
  );
}
