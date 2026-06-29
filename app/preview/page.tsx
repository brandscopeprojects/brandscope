import Link from "next/link";

// Index of design previews (populated with sample data). Public; review-only.
const PREVIEWS = [
  { href: "/preview/dashboard", label: "Dashboard" },
  { href: "/preview/action-plan", label: "Action Plan" },
  { href: "/preview/geo-aeo-seo", label: "GEO / AEO / SEO Visibility" },
];

export default function PreviewIndex() {
  return (
    <div className="min-h-screen bg-base">
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-display text-2xl font-bold text-ink">Design previews</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Screens populated with the RiversBet sample dataset.
        </p>
        <ul className="mt-6 space-y-2">
          {PREVIEWS.map((p) => (
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
      </div>
    </div>
  );
}
