// Public design preview of GEO / AEO / SEO Visibility (#5), populated with the
// RiversBet sample data. No auth/Supabase.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { GeoAIVisibilityScore } from "@/components/intelligence/GeoAIVisibilityScore";
import { GeoPlatformBreakdownTable } from "@/components/intelligence/GeoPlatformBreakdownTable";
import { GeoCompetitorScores } from "@/components/intelligence/GeoCompetitorScores";
import { GeoEvidenceList } from "@/components/intelligence/GeoEvidenceList";
import { DEMO_BRAND, DEMO_GEO } from "@/lib/data/demo";

export const dynamic = "force-dynamic";

export default function PreviewGeo() {
  const geo = DEMO_GEO;
  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-6">
        <div className="space-y-6">
          <PageHeader
            title="GEO / AEO / SEO Visibility"
            subtitle="How visible your brand is across AI answer engines — ChatGPT, Claude, Gemini and Perplexity."
            scanWeek={geo.scanWeek}
          />
          <GeoAIVisibilityScore score={geo.score} trend={geo.scoreChangeWow} />
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">Platform breakdown</h2>
            <GeoPlatformBreakdownTable rows={geo.platforms} />
          </section>
          <GeoCompetitorScores
            brandName={DEMO_BRAND.name}
            brandScore={geo.score}
            competitors={geo.competitorScores}
          />
          <GeoEvidenceList
            title="Notable AI mentions"
            items={geo.topMentions.map((m) => ({ label: m.platform, url: m.url, snippet: m.snippet }))}
          />
        </div>
      </div>
    </div>
  );
}
