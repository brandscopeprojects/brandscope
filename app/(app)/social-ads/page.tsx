// Social & Ads Intelligence (Screen 8, /social-ads).
//
// MVP: this is a PLACEHOLDER page (CLAUDE.md hard exclusion / mvp-constraints).
//   - Social intelligence (followers, engagement, content) is Phase 2 — it needs
//     Apify, a HARD EXCLUSION — so we show an honest "coming soon" EmptyState and
//     NEVER fabricate social numbers we can't verify.
//   - The Ad Network section IS built, sourced from tech_stack_cache (DetectZeStack)
//     via lib/data/social-ads.ts (same read pattern as /tech-stack). For depth it
//     links to the full /tech-stack page rather than duplicating it.
//
// Content-only — the (app) layout provides the shell and gates user + brand.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { SocialAdsNetworkTable } from "@/components/intelligence/SocialAdsNetworkTable";
import { getSocialAdsData } from "@/lib/data/social-ads";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "Ad-network presence today; full social intelligence is coming in a later phase.";

export default async function SocialAdsPage() {
  const data = await getSocialAdsData();

  return (
    <div className="space-y-6">
      <PageHeader title="Social & Ads" subtitle={SUBTITLE} scanWeek={data?.scanWeek ?? null} />

      <section className="space-y-3">
        <EmptyState
          intent="phase2"
          title="Social intelligence — coming soon"
          message="Follower counts, engagement and content analysis across social platforms arrive in Phase 2. We never show estimated social numbers we can't verify."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">Ad Network Intelligence</h2>
        {data ? (
          <SocialAdsNetworkTable rows={data.competitors} />
        ) : (
          <EmptyState
            intent="scanning"
            title="No ad-network data yet"
            message="Your first scan will detect competitor ad networks via DetectZeStack."
          />
        )}
      </section>
    </div>
  );
}
