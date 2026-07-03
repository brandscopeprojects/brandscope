import Link from "next/link";

// Index of design previews (populated with the RiversBet sample data). Public.
const BRAND_PREVIEWS = [
  { href: "/preview/onboarding", label: "Onboarding Wizard" },
  { href: "/preview/dashboard", label: "Dashboard" },
  { href: "/preview/market-intel", label: "Market Intelligence" },
  { href: "/preview/promotions", label: "Promotion Signals" },
  { href: "/preview/competitors", label: "Competitor Profile (SportyBet)" },
  { href: "/preview/social-ads", label: "Social & Ads" },
  { href: "/preview/regulatory", label: "Regulatory Compliance" },
  { href: "/preview/customers", label: "Customer Intelligence" },
  { href: "/preview/geo-aeo-seo", label: "GEO / AEO / SEO Visibility" },
  { href: "/preview/action-plan", label: "Action Plan" },
];

const BRAND_ADMIN_PREVIEWS = [
  { href: "/preview/admin-settings", label: "Brand Settings & Configuration" },
  { href: "/preview/admin-competitors", label: "Competitor Management" },
  { href: "/preview/admin-alerts", label: "Alert Preferences" },
  { href: "/preview/admin-billing", label: "Billing & Subscription" },
];

const INTERNAL_ADMIN_PREVIEWS = [
  { href: "/preview/internal-health", label: "System Health" },
  { href: "/preview/internal-agents", label: "Agent Control" },
  { href: "/preview/internal-api", label: "API Management" },
  { href: "/preview/internal-security", label: "Security Centre" },
  { href: "/preview/internal-knowledge", label: "Knowledge Base" },
  { href: "/preview/internal-revenue", label: "Revenue Dashboard" },
];

function PreviewGroup({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  return (
    <section className="mt-8 first:mt-6">
      <h2 className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="block rounded-card bg-card p-4 text-cobalt shadow-sh1 transition-colors hover:bg-base-secondary"
            >
              {p.label} →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function PreviewIndex() {
  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-display text-2xl font-bold text-ink">Design previews</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Screens populated with the RiversBet sample dataset.
        </p>
        <PreviewGroup title="Brand intelligence" items={BRAND_PREVIEWS} />
        <PreviewGroup title="Brand admin" items={BRAND_ADMIN_PREVIEWS} />
        <PreviewGroup title="Internal admin" items={INTERNAL_ADMIN_PREVIEWS} />
      </div>
    </div>
  );
}
