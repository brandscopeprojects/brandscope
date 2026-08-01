"use client";

// Portfolio Home content — the cross-brand landing. Renders a "needs attention"
// feed (urgent/watch recs across all brands) + one card per brand with Open
// (switch active brand → dashboard) and Scan now (manual scan) actions.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { marketLabel } from "@/lib/format";
import { setActiveBrand, scanBrand } from "@/lib/data/brand-actions";
import type { PortfolioBrand, NeedsAttentionItem } from "@/lib/data/portfolio";

const URGENCY: Record<string, { label: string; cls: string }> = {
  urgent: { label: "Urgent", cls: "bg-urgent/10 text-urgent" },
  watch: { label: "Watch", cls: "bg-watch/10 text-watch" },
  opportunity: { label: "Opportunity", cls: "bg-opportunity/10 text-opportunity" },
};

const THREAT_CLS: Record<string, string> = {
  high: "text-urgent",
  medium: "text-watch",
  low: "text-opportunity",
};

export function PortfolioClient({
  brands,
  needsAttention,
}: {
  brands: PortfolioBrand[];
  needsAttention: NeedsAttentionItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function openBrand(id: string) {
    setBusy(`open:${id}`);
    startTransition(async () => {
      await setActiveBrand(id);
      router.push("/dashboard");
    });
  }

  function scan(id: string) {
    setBusy(`scan:${id}`);
    startTransition(async () => {
      await scanBrand(id);
      router.refresh();
      setBusy(null);
    });
  }

  return (
    <div className="space-y-8">
      {/* Needs attention across all brands */}
      {needsAttention.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
            <AlertTriangle className="h-4 w-4 text-watch" /> Needs attention
          </h2>
          <ul className="divide-y divide-divider overflow-hidden rounded-card border border-divider bg-card shadow-sh1">
            {needsAttention.map((item, i) => {
              const u = URGENCY[item.urgency] ?? URGENCY.watch;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => openBrand(item.brandId)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-base-secondary"
                  >
                    <span className={`shrink-0 rounded-chip px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wide ${u.cls}`}>
                      {u.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{item.headline}</span>
                      <span className="text-xs text-ink-secondary">{item.brandName}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Brand cards */}
      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-ink">
          Brands <span className="text-ink-faint">({brands.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {brands.map((b) => {
            const scanning = b.scanStatus === "running" || b.scanStatus === "pending";
            return (
              <div key={b.id} className="flex flex-col rounded-card border border-divider bg-card p-5 shadow-sh1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-base font-bold text-ink">{b.name}</h3>
                    <p className="truncate text-xs text-ink-secondary">
                      {b.market.length > 0 ? b.market.map(marketLabel).join(", ") : "—"}
                    </p>
                  </div>
                  {b.openUrgent > 0 && (
                    <span className="shrink-0 rounded-chip bg-urgent/10 px-2 py-0.5 font-mono text-[0.65rem] text-urgent">
                      {b.openUrgent} urgent
                    </span>
                  )}
                </div>

                {b.scanned ? (
                  <dl className="mt-4 grid grid-cols-3 gap-2">
                    <Metric label="AI vis" value={b.aiVisibility != null ? String(b.aiVisibility) : "—"} />
                    <Metric
                      label="Threat"
                      value={b.threatLevel ?? "—"}
                      cls={b.threatLevel ? THREAT_CLS[b.threatLevel] : undefined}
                    />
                    <Metric label="SOV" value={b.sovPct != null ? `${Math.round(b.sovPct)}%` : "—"} />
                  </dl>
                ) : (
                  <p className="mt-4 rounded-chip bg-base-secondary px-3 py-2 text-xs text-ink-secondary">
                    {scanning ? "Scan in progress…" : "Not scanned yet — run the first scan to populate this brand."}
                  </p>
                )}

                <p className="mt-3 font-mono text-[0.7rem] text-ink-faint">
                  {b.lastScanWeek ? `Last scan: week of ${b.lastScanWeek}` : "No scans yet"}
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openBrand(b.id)}
                    disabled={busy === `open:${b.id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-chip bg-cobalt px-3 py-2 text-sm font-medium text-card hover:opacity-90 disabled:opacity-60"
                  >
                    {busy === `open:${b.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => scan(b.id)}
                    disabled={busy === `scan:${b.id}` || scanning}
                    title={scanning ? "A scan is already running" : "Run a fresh scan"}
                    className="flex items-center justify-center gap-1.5 rounded-chip border border-divider px-3 py-2 text-sm text-ink-secondary hover:bg-base-secondary hover:text-ink disabled:opacity-60"
                  >
                    {busy === `scan:${b.id}` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {scanning ? "Scanning" : "Scan now"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-chip bg-base-secondary px-2 py-1.5 text-center">
      <dd className={`font-display text-lg font-bold capitalize ${cls ?? "text-ink"}`}>{value}</dd>
      <dt className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-faint">{label}</dt>
    </div>
  );
}
