import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StatusTone } from "@/components/intelligence/StatusPill";

/**
 * Internal-admin Revenue Dashboard data (Screen 29, /brandscope-admin/revenue).
 *
 * The three source tables — `revenue_metrics`, `subscriptions`, `churn_events`
 * — are ALL Class-2 (service-role-only) and their data is GLOBAL (platform-wide,
 * not brand-scoped). We therefore read them with the ADMIN client
 * (createAdminClient), which bypasses RLS. The internal-admin layout has already
 * verified the caller's internal-admin role (requireInternalAdmin), so no
 * additional scoping is applied — the data is platform-wide by design.
 *
 * Every value returned is REAL — pulled straight from the tables. Where a table
 * has no rows we return an empty array / null; the page renders an honest empty
 * state rather than fabricating metrics.
 *
 * Money is stored in KOBO across the schema → formatted to naira (÷100)
 * defensively here. We never trust the column to be non-null / finite.
 *
 * NOTE ON COST: `revenue_metrics` carries `api_cost_kobo`, `infra_cost_kobo` and
 * `gross_margin_pct`, but Screen 29's MVP component set (per the build spec) is
 * the MRR trend, subscription table and churn table — there is no separate
 * cost_logs table, and the cost/margin visual is out of scope for this page, so
 * those columns are intentionally NOT surfaced here.
 */

// ── primitives ───────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** kobo → naira, defensively (null/non-finite in → null out). */
function koboToNaira(kobo: unknown): number | null {
  const n = num(kobo);
  return n == null ? null : n / 100;
}

/** Naira amount → "₦12,500.00". null in → "—". */
function formatNaira(naira: number | null): string {
  if (naira == null) return "—";
  return `₦${naira.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Compact naira for headline tiles → "₦1.2m" / "₦340k" / "₦0". null → "—". */
function formatNairaCompact(naira: number | null): string {
  if (naira == null) return "—";
  const abs = Math.abs(naira);
  if (abs >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}m`;
  if (abs >= 1_000) return `₦${(naira / 1_000).toFixed(naira / 1_000 < 10 ? 1 : 0)}k`;
  return `₦${Math.round(naira).toLocaleString("en-NG")}`;
}

/** ISO date → "23 Jun 2026" (UTC). null/invalid → "—". */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** YYYY-MM-DD week label for the chart axis → "23 Jun". */
function formatWeekShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Title-case a snake/kebab key, e.g. "growth_tier" → "Growth Tier". */
function humanise(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Map a subscription status string → StatusPill tone + display label. */
function subscriptionStatus(status: string | null): {
  label: string;
  tone: StatusTone;
} {
  const s = (status ?? "").toLowerCase();
  if (s === "active" || s === "trialing") {
    return { label: humanise(status || "active"), tone: "good" };
  }
  if (s === "past_due" || s === "unpaid" || s === "incomplete") {
    return { label: humanise(status || "past due"), tone: "bad" };
  }
  if (s === "canceled" || s === "cancelled" || s === "paused") {
    return { label: humanise(status || "canceled"), tone: "warn" };
  }
  return { label: status ? humanise(status) : "Unknown", tone: "neutral" };
}

// ── view models ──────────────────────────────────────────────────────────────

/** A single week's MRR point for the trend chart. */
export type MrrTrendPoint = {
  /** Source period_week (YYYY-MM-DD), used as a stable key. */
  week: string;
  /** Short axis label, e.g. "23 Jun". */
  label: string;
  /** MRR in naira (÷100). null when the source value was missing. */
  mrrNaira: number | null;
};

/** Headline metrics derived from the latest revenue_metrics row + active subs. */
export type RevenueLatest = {
  mrrLabel: string;
  /** MoM MRR delta in naira vs the prior period; null when no prior period. */
  mrrDeltaNaira: number | null;
  activeSubscriptions: number;
  /** Churn rate this period (%), churned / active, or null when not derivable. */
  churnRatePct: number | null;
  churnedBrands: number | null;
  /** ARPA (avg revenue per account) in naira, pre-formatted. */
  arpaLabel: string;
  newBrands: number | null;
  periodLabel: string;
};

export type SubscriptionRow = {
  id: string;
  org: string;
  plan: string;
  mrrLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  startedLabel: string;
};

export type ChurnRow = {
  id: string;
  org: string;
  /** Reason / event-type label. */
  reason: string;
  /** Value lost (positive naira figure), pre-formatted. */
  valueLostLabel: string;
  dateLabel: string;
  /** urgent when a real MRR loss was recorded, otherwise watch. Never green. */
  tone: Extract<StatusTone, "bad" | "warn">;
};

export type InternalRevenueData = {
  metricsTrend: MrrTrendPoint[];
  latest: RevenueLatest | null;
  subscriptions: SubscriptionRow[];
  churn: ChurnRow[];
};

// ── fetcher ──────────────────────────────────────────────────────────────────

/**
 * Load the global Revenue snapshot. Returns typed view models with empty arrays
 * / null where a table has no rows. Never throws on missing data; the page
 * decides between the empty state and the populated sections.
 */
export async function getInternalRevenue(): Promise<InternalRevenueData> {
  const supabase = createAdminClient();

  const [metricsRes, subsRes, churnRes] = await Promise.all([
    // Full MRR/ARR time series, oldest → newest for charting.
    supabase
      .from("revenue_metrics")
      .select(
        "id, period_week, mrr_kobo, revenue_kobo, arpb_kobo, active_brands, new_brands, churned_brands",
      )
      .order("period_week", { ascending: true })
      .limit(104),
    // All subscriptions + their organisation name, for the per-brand revenue table.
    supabase
      .from("subscriptions")
      .select(
        "id, plan, mrr_kobo, status, current_period_start, created_at, organisations(name)",
      )
      .order("mrr_kobo", { ascending: false, nullsFirst: false })
      .limit(200),
    // Recent churn events + organisation name, newest first.
    supabase
      .from("churn_events")
      .select(
        "id, event_type, reason, mrr_delta_kobo, occurred_at, organisations(name)",
      )
      .order("occurred_at", { ascending: false })
      .limit(50),
  ]);

  // ── revenue_metrics → MRR trend + latest headline ──
  const metricRows = metricsRes.data ?? [];
  const metricsTrend: MrrTrendPoint[] = metricRows.map((row) => ({
    week: row.period_week,
    label: formatWeekShort(row.period_week),
    mrrNaira: koboToNaira(row.mrr_kobo),
  }));

  let latest: RevenueLatest | null = null;
  if (metricRows.length > 0) {
    const last = metricRows[metricRows.length - 1];
    const prev = metricRows.length > 1 ? metricRows[metricRows.length - 2] : null;

    const mrrNaira = koboToNaira(last.mrr_kobo);
    const prevMrrNaira = prev ? koboToNaira(prev.mrr_kobo) : null;
    const mrrDeltaNaira =
      mrrNaira != null && prevMrrNaira != null
        ? Math.round(mrrNaira - prevMrrNaira)
        : null;

    const active = num(last.active_brands);
    const churned = num(last.churned_brands);
    const churnRatePct =
      active != null && active > 0 && churned != null
        ? Math.round((churned / active) * 1000) / 10
        : null;

    latest = {
      mrrLabel: formatNairaCompact(mrrNaira),
      mrrDeltaNaira,
      activeSubscriptions: active ?? 0,
      churnRatePct,
      churnedBrands: churned,
      arpaLabel: formatNairaCompact(koboToNaira(last.arpb_kobo)),
      newBrands: num(last.new_brands),
      periodLabel: formatDate(last.period_week),
    };
  }

  // ── subscriptions → per-org revenue rows ──
  const subscriptions: SubscriptionRow[] = (subsRes.data ?? []).map((row) => {
    const status = subscriptionStatus(row.status);
    return {
      id: row.id,
      org: row.organisations?.name ?? "Unknown organisation",
      plan: humanise(row.plan),
      mrrLabel: formatNaira(koboToNaira(row.mrr_kobo)),
      statusLabel: status.label,
      statusTone: status.tone,
      startedLabel: formatDate(row.current_period_start ?? row.created_at),
    };
  });

  // ── churn_events → recent churn rows ──
  const churn: ChurnRow[] = (churnRes.data ?? []).map((row) => {
    const delta = koboToNaira(row.mrr_delta_kobo);
    // mrr_delta is typically negative for a churn (revenue lost); show the
    // magnitude as the value lost. Treat a recorded loss as urgent, else watch.
    const lost = delta != null ? Math.abs(delta) : null;
    return {
      id: row.id,
      org: row.organisations?.name ?? "Unknown organisation",
      reason: row.reason?.trim() || humanise(row.event_type),
      valueLostLabel: formatNaira(lost),
      dateLabel: formatDate(row.occurred_at),
      tone: lost != null && lost > 0 ? "bad" : "warn",
    };
  });

  return { metricsTrend, latest, subscriptions, churn };
}
