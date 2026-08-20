// Screen — Internal-admin Competitive Intelligence, /brandscope-admin/competitive-intelligence.
// Gate 1 closure deliverable: back-office control surface for the Market
// Power Engine's versioned scoring config, customer-facing methodology
// content, the canonical operator-market universe, and the audit trail
// (config activation history + tier override events). Engine calculation
// itself (evidence adapters, orchestrator, snapshot writes) is Gate 2+ and
// is NOT implemented here — this page only lets a platform admin configure
// and audit the engine ahead of that work.
//
// requireInternalAdmin() (layout-level) gates the whole route. Normal
// customer users and brand admins have no path to this surface at all — it
// is not nested in the (app) shell and is not linked from any brand page.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { requireInternalAdmin } from "@/lib/auth";
import { ScoringConfigPanel } from "@/components/admin/ScoringConfigPanel";
import { MethodologyContentEditor } from "@/components/admin/MethodologyContentEditor";
import {
  getMethodologyContent,
  getOperatorMarketPresence,
  getScoringConfigHistory,
  getScoringConfigs,
  getTierOverrides,
} from "@/lib/data/internal-competitive-intelligence";

export const dynamic = "force-dynamic";

export default async function CompetitiveIntelligencePage() {
  const profile = await requireInternalAdmin();
  const [configs, content, presence, history, overrides] = await Promise.all([
    getScoringConfigs(),
    getMethodologyContent(),
    getOperatorMarketPresence(),
    getScoringConfigHistory(),
    getTierOverrides(),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Competitive Intelligence"
        subtitle="Market Power Engine scoring configuration, methodology content, operator-market universe and audit trail. No scores are calculated or shown to customers from this build yet."
      />

      <section className="space-y-3">
        <h2 className="font-display text-base font-bold text-ink">Engine configuration</h2>
        <ScoringConfigPanel configs={configs} actorProfileId={profile.id} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-bold text-ink">Methodology content</h2>
        <p className="text-sm text-ink-secondary">
          Customer-facing tooltip and "How Brandscope calculates this" copy. Exact weights and thresholds are never
          part of this content.
        </p>
        <MethodologyContentEditor content={content} actorProfileId={profile.id} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-bold text-ink">
          Operator-market universe ({presence.length})
        </h2>
        <p className="text-sm text-ink-secondary">
          Canonical verified Operator × Market membership — the calculation universe. Empty until Gate 2's
          verification pipeline populates it; historical customer tracking alone never establishes presence here.
        </p>
        {presence.length === 0 ? (
          <p className="text-sm text-ink-faint">No operator-market presence records yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-divider">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-secondary text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-3 py-2">Operator</th>
                  <th className="px-3 py-2">Market</th>
                  <th className="px-3 py-2">Presence</th>
                  <th className="px-3 py-2">Verification</th>
                  <th className="px-3 py-2">Last verified</th>
                </tr>
              </thead>
              <tbody>
                {presence.map((p) => (
                  <tr key={p.id} className="border-t border-divider">
                    <td className="px-3 py-2">
                      {p.competitorName} <span className="text-ink-faint">({p.competitorDomain})</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.marketCode}</td>
                    <td className="px-3 py-2">{p.presenceStatus}</td>
                    <td className="px-3 py-2">{p.verificationStatus}</td>
                    <td className="px-3 py-2 text-ink-faint">
                      {p.lastVerifiedAt ? new Date(p.lastVerifiedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-bold text-ink">Config activation history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-faint">No config changes yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-divider">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-secondary text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Change</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-divider">
                    <td className="px-3 py-2">v{h.configVersion}</td>
                    <td className="px-3 py-2">{h.changeType}</td>
                    <td className="px-3 py-2 text-ink-secondary">{h.changeReason ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-faint">{h.changedByEmail ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-faint">{new Date(h.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-bold text-ink">Tier override history</h2>
        {overrides.length === 0 ? (
          <p className="text-sm text-ink-faint">
            No overrides yet. Overriding a calculated tier is exceptional, append-only, and requires a reason —
            there is no path here to edit a raw calculated score.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-divider">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-secondary text-xs uppercase text-ink-faint">
                <tr>
                  <th className="px-3 py-2">Brand</th>
                  <th className="px-3 py-2">Operator</th>
                  <th className="px-3 py-2">Market</th>
                  <th className="px-3 py-2">Calculated → Override</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Active</th>
                  <th className="px-3 py-2">Expires</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.id} className="border-t border-divider">
                    <td className="px-3 py-2">{o.brandName}</td>
                    <td className="px-3 py-2">{o.competitorName}</td>
                    <td className="px-3 py-2 font-mono text-xs">{o.marketCode}</td>
                    <td className="px-3 py-2">
                      {o.previousCalculatedValue} → {o.overrideValue}
                    </td>
                    <td className="px-3 py-2 text-ink-secondary">{o.reason}</td>
                    <td className="px-3 py-2 text-ink-faint">{o.actorEmail ?? "—"}</td>
                    <td className="px-3 py-2">{o.isActive ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 text-ink-faint">
                      {o.expiresAt ? new Date(o.expiresAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
