// Customer Intelligence — Screen 11 (`/customers`). Reads the per-competitor
// `customer_intel_cache` (DataForSEO traffic / content analysis / app reviews,
// cron-populated) for the latest scan_week and lays out: headline stats (app
// rating, reviews tracked, sentiment), complaint themes mined from reviews, a
// per-competitor traffic-channel donut, and inferred demographics.
//
// Customer Intelligence is a PARTIAL module (mvp-constraints §2): only inferred
// fields ship. The demographics sub-section degrades to a Phase-2 EmptyState
// when DataForSEO returns no inference — it is never faked. Auth + brand gating
// + the shell live in app/(app)/layout.tsx. Before the first scan populates the
// cache we render the honest "scanning" empty state (CLAUDE.md: no fake data
// inside a v1 page).

import { getCurrentBrand } from "@/lib/data/brand";
import { getCustomerIntelData } from "@/lib/data/customers";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { CustomersComplaintThemes } from "@/components/intelligence/CustomersComplaintThemes";
import { CustomersTrafficSources } from "@/components/intelligence/CustomersTrafficSources";
import { CustomersDemographics } from "@/components/intelligence/CustomersDemographics";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "Inferred audience, sentiment and complaint themes across your competitors.";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="text-xs text-ink-secondary">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Average a list of numbers, or null when empty. */
function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Format an app-review sentiment score for display. The schema does not fix
 *  the scale, so format defensively: a -1..1 value renders as a signed 2-dp
 *  number; anything else renders rounded as-is. Honest about an unknown scale
 *  rather than asserting a percentage we can't guarantee. */
function formatSentiment(avg: number): string {
  if (avg >= -1 && avg <= 1) return avg.toFixed(2);
  return `${Math.round(avg)}`;
}

export default async function CustomersPage() {
  const brand = await getCurrentBrand();
  // Layout already redirects when there's no brand; this satisfies the type and
  // guards a direct render.
  if (!brand) return null;

  const data = await getCustomerIntelData(brand);

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Customer Intelligence" subtitle={SUBTITLE} />
        <EmptyState
          title="No customer data yet"
          message="Your first scan will infer audience, app sentiment and complaint themes from DataForSEO."
          intent="scanning"
        />
      </div>
    );
  }

  const { scanWeek, competitors } = data;

  // Headline stats — real, derivable values only.
  const avgRating = average(
    competitors.map((c) => c.appRating).filter((r): r is number => r != null),
  );
  const totalReviews = competitors
    .map((c) => c.appReviewCount)
    .filter((r): r is number => r != null)
    .reduce((sum, r) => sum + r, 0);
  const reviewsTracked = competitors.some((c) => c.appReviewCount != null);
  const avgSentiment = average(
    competitors.map((c) => c.sentiment).filter((s): s is number => s != null),
  );

  const stats: Stat[] = [
    { label: "Competitors tracked", value: competitors.length },
    {
      label: "Avg app rating",
      value: avgRating != null ? avgRating.toFixed(1) : "—",
    },
    {
      label: "Reviews tracked",
      value: reviewsTracked ? totalReviews.toLocaleString() : "—",
    },
    {
      label: "Avg sentiment",
      value: avgSentiment != null ? formatSentiment(avgSentiment) : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Customer Intelligence" subtitle={SUBTITLE} scanWeek={scanWeek} />

      <StatStrip stats={stats} />

      <SectionCard
        title="Complaint themes"
        description="Recurring complaints mined from app reviews, tinted by sentiment."
      >
        <CustomersComplaintThemes competitors={competitors} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="Traffic channels"
          description="Inferred channel mix for a selected competitor this week."
        >
          <CustomersTrafficSources competitors={competitors} />
        </SectionCard>

        <SectionCard
          title="Inferred demographics"
          description="Age and gender bands inferred from audience signals."
        >
          <CustomersDemographics competitors={competitors} />
        </SectionCard>
      </div>
    </div>
  );
}
