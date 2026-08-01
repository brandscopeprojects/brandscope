import Link from "next/link";
import { Plus } from "lucide-react";
import { getPortfolio } from "@/lib/data/portfolio";
import { PortfolioClient } from "@/components/portfolio/PortfolioClient";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const { brands, needsAttention } = await getPortfolio();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Portfolio</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Every brand you track, and what needs attention this week.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="flex items-center gap-1.5 rounded-chip bg-cobalt px-3 py-2 text-sm font-medium text-card hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add brand
        </Link>
      </header>

      {brands.length === 0 ? (
        <div className="rounded-card border border-divider bg-card p-10 text-center shadow-sh1">
          <p className="text-sm text-ink-secondary">No brands yet.</p>
          <Link
            href="/onboarding"
            className="mt-4 inline-flex items-center gap-1.5 rounded-chip bg-cobalt px-4 py-2 text-sm font-medium text-card hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Add your first brand
          </Link>
        </div>
      ) : (
        <PortfolioClient brands={brands} needsAttention={needsAttention} />
      )}
    </div>
  );
}
