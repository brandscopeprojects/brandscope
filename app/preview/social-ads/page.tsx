// Public design preview of Social & Ads Intelligence (#8), populated with the
// RiversBet sample data. No auth/Supabase. Renders the same components as the real
// /social-ads page: the Phase-2 social "coming soon" EmptyState plus the built
// Ad Network Intelligence table (DEMO_SOCIAL_ADS). Sample data.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { SocialAdsNetworkTable } from "@/components/intelligence/SocialAdsNetworkTable";
import { DEMO_SOCIAL_ADS } from "@/lib/data/demo/social-ads";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "Ad-network presence today; full social intelligence is coming in a later phase.";

export default function PreviewSocialAds() {
  const data = DEMO_SOCIAL_ADS;

  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
        <div className="space-y-6">
          <PageHeader title="Social & Ads" subtitle={SUBTITLE} scanWeek={data.scanWeek} />

          <section className="space-y-3">
            <EmptyState
              intent="phase2"
              title="Social intelligence — coming soon"
              message="Follower counts, engagement and content analysis across social platforms arrive in Phase 2. We never show estimated social numbers we can't verify."
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-ink">Ad Network Intelligence</h2>
            <SocialAdsNetworkTable rows={data.competitors} />
          </section>
        </div>
      </div>
    </div>
  );
}
