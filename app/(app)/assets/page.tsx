// Assets Library (Screen 16, /assets).
// Source: generated_assets (RLS-scoped by brand), read via lib/data/assets.ts.
// Content-only — the (app) layout provides the shell and gates user + brand.
//
// Sections (with data):
//   1. StatStrip — REAL counts only (total assets, pinned, distinct types).
//   2. AssetsGrid — tiles per asset (type badge, title, word count, created date,
//      pinned / flagged indicators); clicking a tile expands an inline preview.
// No assets yet → honest EmptyState (CLAUDE.md: no fake data inside a v1 page).
// Assets are produced by the action-plan generate flow (a later sprint); until
// one is generated, this page shows the empty state rather than placeholder rows.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { StatStrip, type Stat } from "@/components/intelligence/StatStrip";
import { AssetsGrid } from "@/components/intelligence/AssetsGrid";
import { getBrandAssets } from "@/lib/data/assets";

export const dynamic = "force-dynamic";

const SUBTITLE = "Marketing assets generated from your recommendations.";

export default async function AssetsPage() {
  const assets = await getBrandAssets();

  if (assets.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assets Library" subtitle={SUBTITLE} scanWeek={null} />
        <EmptyState
          intent="scanning"
          title="No assets yet"
          message="Assets are generated from your action plan. Generate one from a recommendation and it will appear here."
        />
      </div>
    );
  }

  // Real counts only.
  const pinned = assets.filter((a) => a.isPinned).length;
  const distinctTypes = new Set(assets.map((a) => a.assetType)).size;

  const stats: Stat[] = [
    { label: "Total Assets", value: assets.length },
    { label: "Pinned", value: pinned },
    { label: "Asset Types", value: distinctTypes },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Assets Library" subtitle={SUBTITLE} scanWeek={null} />

      <StatStrip stats={stats} />

      <AssetsGrid assets={assets} />
    </div>
  );
}
