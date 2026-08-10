"use client";

import { useRealtimeCacheSubscription } from "@/lib/hooks/useRealtimeCacheSubscription";
import { SectionSkeleton, SectionErrorFallback } from "@/components/dashboard/SectionSkeleton";

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-card bg-card p-5 shadow-sh1">
    <h3 className="mb-4 text-sm font-semibold text-ink">{title}</h3>
    {children}
  </section>
);

// ─────────────────────────────────────────────────────────────────────────
// SEO / TRAFFIC SECTION
// ─────────────────────────────────────────────────────────────────────────

export function SeoSection({ brandId, scanWeek }: { brandId: string; scanWeek: string }) {
  const { data, isLoading, error } = useRealtimeCacheSubscription({
    tableName: "seo_cache",
    brandId,
    scanWeek,
  });

  return (
    <SectionCard title="Traffic & SEO">
      {isLoading ? (
        <SectionSkeleton />
      ) : error ? (
        <SectionErrorFallback />
      ) : data ? (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-ink-secondary">Domain Authority</p>
              <p className="text-lg font-bold text-ink">{(data as any).domain_authority ?? "—"}</p>
            </div>
            <div>
              <p className="text-ink-secondary">Est. Traffic</p>
              <p className="text-lg font-bold text-ink">
                {(data as any).estimated_traffic?.toLocaleString() ?? "—"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <p className="text-ink-secondary">Organic</p>
              <p className="font-medium text-ink">{(data as any).organic_traffic ?? "—"}</p>
            </div>
            <div>
              <p className="text-ink-secondary">Paid</p>
              <p className="font-medium text-ink">{(data as any).paid_traffic ?? "—"}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">No data yet. Scan initializing...</p>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// GEO / AI VISIBILITY SECTION
// ─────────────────────────────────────────────────────────────────────────

export function GeoAeoSection({ brandId, scanWeek }: { brandId: string; scanWeek: string }) {
  const { data, isLoading, error } = useRealtimeCacheSubscription({
    tableName: "geo_cache",
    brandId,
    scanWeek,
  });

  return (
    <SectionCard title="GEO & AI Visibility">
      {isLoading ? (
        <SectionSkeleton />
      ) : error ? (
        <SectionErrorFallback />
      ) : data ? (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-ink-secondary">AI Visibility Score</p>
            <p className="text-lg font-bold text-ink">
              {(data as any).ai_visibility_score !== null
                ? `${((data as any).ai_visibility_score * 100).toFixed(0)}%`
                : "—"}
            </p>
          </div>
          <div className="space-y-1 pt-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Platforms</p>
            <div className="grid grid-cols-2 gap-2">
              {["chatgpt", "claude", "gemini", "perplexity"].map((platform) => (
                <div key={platform} className="text-xs">
                  <p className="capitalize text-ink-secondary">{platform}</p>
                  <p className="font-medium text-ink">
                    {(data as any)[`${platform}_mentioned`] ? "✓ Mentioned" : "—"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">No data yet. Scan initializing...</p>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TECH STACK SECTION
// ─────────────────────────────────────────────────────────────────────────

export function TechStackSection({ brandId, scanWeek }: { brandId: string; scanWeek: string }) {
  const { data, isLoading, error } = useRealtimeCacheSubscription({
    tableName: "tech_stack_cache",
    brandId,
    scanWeek,
  });

  return (
    <SectionCard title="Tech Stack">
      {isLoading ? (
        <SectionSkeleton />
      ) : error ? (
        <SectionErrorFallback />
      ) : data ? (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-ink-secondary mb-2">Technologies</p>
            <div className="flex flex-wrap gap-1">
              {((data as any).technologies || []).slice(0, 5).map((tech: any, i: number) => (
                <span key={i} className="rounded-chip bg-base-secondary/50 px-2 py-1 text-xs">
                  {tech.name || tech}
                </span>
              ))}
              {((data as any).technologies || []).length > 5 && (
                <span className="text-xs text-ink-secondary">+{(data as any).technologies.length - 5}</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <p className="text-xs text-ink-secondary">Ad Networks</p>
              <p className="font-medium text-ink">{((data as any).ad_networks || []).length || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-secondary">Analytics</p>
              <p className="font-medium text-ink">{((data as any).analytics_tools || []).length || "—"}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">No data yet. Scan initializing...</p>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// APP STORE SECTION
// ─────────────────────────────────────────────────────────────────────────

export function AppStoreSection({ brandId, scanWeek }: { brandId: string; scanWeek: string }) {
  const { data, isLoading, error } = useRealtimeCacheSubscription({
    tableName: "product_intel_cache",
    brandId,
    scanWeek,
  });

  return (
    <SectionCard title="App Store">
      {isLoading ? (
        <SectionSkeleton />
      ) : error ? (
        <SectionErrorFallback />
      ) : data ? (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-ink-secondary">Odds Score</p>
            <p className="text-lg font-bold text-ink">
              {(data as any).odds_competitiveness_score !== null
                ? ((data as any).odds_competitiveness_score * 100).toFixed(0) + "%"
                : "—"}
            </p>
          </div>
          <div className="space-y-1 pt-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Verticals</p>
            <div className="space-y-1">
              {["sports_betting_status", "casino_status", "crash_games_status"].map((field) => (
                <div key={field} className="flex items-center justify-between">
                  <span className="text-ink-secondary capitalize">
                    {field.replace("_status", "").replace(/_/g, " ")}
                  </span>
                  <span className="font-medium text-ink">
                    {(data as any)[field] ? "✓" : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">No data yet. Scan initializing...</p>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// CUSTOMER INTELLIGENCE SECTION
// ─────────────────────────────────────────────────────────────────────────

export function CustomerSection({ brandId, scanWeek }: { brandId: string; scanWeek: string }) {
  const { data, isLoading, error } = useRealtimeCacheSubscription({
    tableName: "customer_intel_cache",
    brandId,
    scanWeek,
  });

  return (
    <SectionCard title="Customer Intelligence">
      {isLoading ? (
        <SectionSkeleton />
      ) : error ? (
        <SectionErrorFallback />
      ) : data ? (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-ink-secondary">Sentiment Score</p>
            <p className="text-lg font-bold text-ink">
              {(data as any).sentiment_score !== null
                ? ((data as any).sentiment_score * 100).toFixed(0) + "%"
                : "—"}
            </p>
          </div>
          <div className="space-y-1 pt-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Traffic Sources</p>
            <p className="text-ink">
              {Array.isArray((data as any).traffic_sources) && (data as any).traffic_sources.length > 0
                ? (data as any).traffic_sources.slice(0, 3).join(", ")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Complaints</p>
            <p className="text-sm text-ink">
              {Array.isArray((data as any).complaint_themes) ? (data as any).complaint_themes.length : 0} themes
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">No data yet. Scan initializing...</p>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// REGULATORY SECTION
// ─────────────────────────────────────────────────────────────────────────

export function RegulatorySection({ brandId, scanWeek }: { brandId: string; scanWeek: string }) {
  const { data, isLoading, error } = useRealtimeCacheSubscription({
    tableName: "regulatory_cache",
    brandId,
    scanWeek,
  });

  return (
    <SectionCard title="Regulatory Compliance">
      {isLoading ? (
        <SectionSkeleton />
      ) : error ? (
        <SectionErrorFallback />
      ) : data ? (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-ink-secondary">Compliance Score</p>
            <p className="text-lg font-bold text-ink">
              {(data as any).compliance_score !== null
                ? ((data as any).compliance_score * 100).toFixed(0) + "%"
                : "—"}
            </p>
          </div>
          <div className="space-y-1 pt-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Market: {(data as any).market}</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-ink-secondary">Violations</span>
                <span className="font-medium text-ink">
                  {Array.isArray((data as any).violations) ? (data as any).violations.length : 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">No data yet. Scan initializing...</p>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PROMOTIONS SECTION
// ─────────────────────────────────────────────────────────────────────────

export function PromotionsSection({ brandId, scanWeek }: { brandId: string; scanWeek: string }) {
  const { data, isLoading, error } = useRealtimeCacheSubscription({
    tableName: "promotions_cache",
    brandId,
    scanWeek,
  });

  return (
    <SectionCard title="Promotions & Bonuses">
      {isLoading ? (
        <SectionSkeleton />
      ) : error ? (
        <SectionErrorFallback />
      ) : data ? (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-ink-secondary">Promotion Title</p>
            <p className="font-medium text-ink">{(data as any).promo_title || "—"}</p>
          </div>
          <div className="space-y-1 pt-2">
            <p className="text-ink-secondary">Type</p>
            <p className="font-medium text-ink capitalize">{(data as any).promo_type || "—"}</p>
          </div>
          <div className="space-y-1 pt-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Bonus Movement</p>
            <div className="flex justify-between">
              <span className="text-ink-secondary">WoW Change</span>
              <span className={`font-medium ${((data as any).wow_bonus_change_pct || 0) > 0 ? "text-success" : "text-ink"}`}>
                {(data as any).wow_bonus_change_pct ? `${((data as any).wow_bonus_change_pct * 100).toFixed(0)}%` : "—"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">No data yet. Scan initializing...</p>
      )}
    </SectionCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// HIRING SECTION
// ─────────────────────────────────────────────────────────────────────────

export function HiringSection({ brandId, scanWeek }: { brandId: string; scanWeek: string }) {
  const { data, isLoading, error } = useRealtimeCacheSubscription({
    tableName: "hiring_signals_cache",
    brandId,
    scanWeek,
  });

  return (
    <SectionCard title="Hiring & Talent Signals">
      {isLoading ? (
        <SectionSkeleton />
      ) : error ? (
        <SectionErrorFallback />
      ) : data ? (
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-ink-secondary">Open Roles</p>
            <p className="text-lg font-bold text-ink">
              {Array.isArray((data as any).roles) ? (data as any).roles.length : 0}
            </p>
          </div>
          <div className="space-y-1 pt-2">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Signal Types</p>
            <div className="flex flex-wrap gap-1">
              {Array.isArray((data as any).signal_types) &&
                (data as any).signal_types.slice(0, 3).map((signal: string, i: number) => (
                  <span key={i} className="rounded-chip bg-base-secondary/50 px-2 py-1 text-xs capitalize">
                    {signal.replace(/_/g, " ")}
                  </span>
                ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint pt-2">Geographic Expansion</p>
            <p className="text-sm text-ink">
              {Array.isArray((data as any).geographic_expansion) ? (data as any).geographic_expansion.length : 0} markets
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">No data yet. Scan initializing...</p>
      )}
    </SectionCard>
  );
}
