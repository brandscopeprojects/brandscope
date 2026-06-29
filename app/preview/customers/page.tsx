// Public design preview of Customer Intelligence (#10), populated with the
// RiversBet sample data so the real components are visible. No auth/Supabase.
// Mirrors the composition of app/(app)/customers/page.tsx with DEMO_CUSTOMERS.
// Customer Intelligence is a PARTIAL module — only inferred fields ship; this
// preview is explicitly sample data.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { CustomersComplaintThemes } from "@/components/intelligence/CustomersComplaintThemes";
import { CustomersTrafficSources } from "@/components/intelligence/CustomersTrafficSources";
import { CustomersDemographics } from "@/components/intelligence/CustomersDemographics";
import { DEMO_CUSTOMERS } from "@/lib/data/demo/customers";

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
        {description && (
          <p className="text-xs text-ink-secondary">{description}</p>
        )}
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

/** Format an app-review sentiment score for display (mirrors the live page). */
function formatSentiment(avg: number): string {
  if (avg >= -1 && avg <= 1) return avg.toFixed(2);
  return `${Math.round(avg)}`;
}

export default function PreviewCustomers() {
  const { scanWeek, competitors } = DEMO_CUSTOMERS;

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
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
        <div className="space-y-6">
          <PageHeader
            title="Customer Intelligence"
            subtitle={SUBTITLE}
            scanWeek={scanWeek}
          />

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
      </div>
    </div>
  );
}
