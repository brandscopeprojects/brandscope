"use client";

import {
  SeoSection,
  GeoAeoSection,
  TechStackSection,
  AppStoreSection,
  CustomerSection,
  RegulatorySection,
  PromotionsSection,
  HiringSection,
} from "@/components/dashboard/ModuleSections";

export function ModuleStreamingView({ brandId, scanWeek }: { brandId: string; scanWeek: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Module Intelligence (Real-time)</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Sections update as each researcher completes their analysis
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SeoSection brandId={brandId} scanWeek={scanWeek} />
        <GeoAeoSection brandId={brandId} scanWeek={scanWeek} />
        <TechStackSection brandId={brandId} scanWeek={scanWeek} />
        <AppStoreSection brandId={brandId} scanWeek={scanWeek} />
        <CustomerSection brandId={brandId} scanWeek={scanWeek} />
        <RegulatorySection brandId={brandId} scanWeek={scanWeek} />
        <PromotionsSection brandId={brandId} scanWeek={scanWeek} />
        <HiringSection brandId={brandId} scanWeek={scanWeek} />
      </div>
    </div>
  );
}
