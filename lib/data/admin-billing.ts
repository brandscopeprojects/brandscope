import "server-only";
import { cache } from "react";
import { requireBrandAdmin } from "@/lib/auth";
import { getCurrentOrganisationId } from "@/lib/data/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/data/demo-mode";
import type { StatusTone } from "@/components/intelligence/StatusPill";
import type { Database } from "@/types/database.types";

// Billing data (Screen 23, brand admin). READ-ONLY at MVP — no payment provider
// integration. `subscriptions`, `payment_history`, `usage_metrics` are Class-2
// (service-role-only, organisation-scoped) per rls-policies.md: NOT readable by
// the user-session client. We read them through the ADMIN (service-role) client
// and scope by organisation_id IN CODE. requireBrandAdmin() is called first as
// defense-in-depth (the layout already gates the route).
//
// Money is stored in kobo → formatted to naira (÷100) defensively here.

// ── helpers ────────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** kobo → naira, defensively (null/non-finite in → null out). */
function koboToNaira(kobo: unknown): number | null {
  const n = num(kobo);
  return n == null ? null : n / 100;
}

/** Naira amount → "₦12,500.00". null in → null out. */
function formatNaira(naira: number | null): string | null {
  if (naira == null) return null;
  return `₦${naira.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** ISO date → "23 Jun 2026" (UTC). null/invalid in → null out. */
function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Title-case a snake/kebab plan key, e.g. "growth_tier" → "Growth Tier". */
function humanise(raw: string): string {
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

/** Map a payment status string → StatusPill tone + display label. */
function paymentStatus(status: string | null): {
  label: string;
  tone: StatusTone;
} {
  const s = (status ?? "").toLowerCase();
  if (s === "paid" || s === "succeeded" || s === "success") {
    return { label: humanise(status || "paid"), tone: "good" };
  }
  if (s === "pending" || s === "processing") {
    return { label: humanise(status || "pending"), tone: "warn" };
  }
  if (s === "failed" || s === "refunded" || s === "void") {
    return { label: humanise(status || "failed"), tone: "bad" };
  }
  return { label: status ? humanise(status) : "Unknown", tone: "neutral" };
}

// ── view models ──────────────────────────────────────────────────────────────

export type PlanView = {
  name: string;
  status: { label: string; tone: StatusTone };
  /** Monthly price in naira, pre-formatted (e.g. "₦150,000.00"); null if unknown. */
  priceLabel: string | null;
  /** Renewal date, pre-formatted (e.g. "23 Jul 2026"); null if unknown. */
  renewsAtLabel: string | null;
  /** True when the subscription is set to end at the period boundary. */
  cancelAtPeriodEnd: boolean;
  /** Trial end date pre-formatted; null if not on a trial. */
  trialEndsAtLabel: string | null;
};

export type UsageMetricView = {
  label: string;
  used: number;
  /** Plan limit; null when not tracked / unlimited (no bar rendered). */
  limit: number | null;
};

export type UsageView = {
  /** Billing period, pre-formatted (e.g. "1 Jun 2026 – 30 Jun 2026"); null if unknown. */
  periodLabel: string | null;
  metrics: UsageMetricView[];
};

export type PaymentRowView = {
  id: string;
  /** Paid/failed/created date, pre-formatted; null if unknown. */
  dateLabel: string | null;
  description: string;
  /** Amount in naira, pre-formatted; null if unknown. */
  amountLabel: string | null;
  status: { label: string; tone: StatusTone };
};

export type BillingData = {
  plan: PlanView;
  usage: UsageView | null;
  payments: PaymentRowView[];
};

type SubscriptionRow =
  Database["public"]["Tables"]["subscriptions"]["Row"];
type PaymentRow = Database["public"]["Tables"]["payment_history"]["Row"];
type UsageRow = Database["public"]["Tables"]["usage_metrics"]["Row"];

// ── data ─────────────────────────────────────────────────────────────────────

/**
 * Billing view model for the signed-in brand admin's organisation, or null when
 * there is no subscription record yet (page renders the empty state).
 */
export const getBillingData = cache(
  async function getBillingData(): Promise<BillingData | null> {
    // Demo short-circuit FIRST — before any auth/org/service-role calls. In demo
    // mode there is no real session, so requireBrandAdmin() must not run.
    if (isDemoMode()) {
      const { DEMO_ADMIN_BILLING } = await import(
        "@/lib/data/demo/admin-billing"
      );
      return DEMO_ADMIN_BILLING;
    }

    // Defense-in-depth: the layout already gated, but re-assert the role here so
    // the service-role read can never run for a non-admin session.
    await requireBrandAdmin();

    const orgId = await getCurrentOrganisationId();
    if (!orgId) return null;

    const admin = createAdminClient();

    const [subRes, payRes, usageRes] = await Promise.all([
      admin
        .from("subscriptions")
        .select("*")
        .eq("organisation_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("payment_history")
        .select("*")
        .eq("organisation_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("usage_metrics")
        .select("*")
        .eq("organisation_id", orgId)
        .order("period_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const subscription = subRes.data as SubscriptionRow | null;
    if (!subscription) return null;

    const plan: PlanView = {
      name: humanise(subscription.plan),
      status: subscriptionStatus(subscription.status),
      priceLabel: formatNaira(koboToNaira(subscription.mrr_kobo)),
      renewsAtLabel: formatDate(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
      trialEndsAtLabel: formatDate(subscription.trial_ends_at),
    };

    const usage = mapUsage(usageRes.data as UsageRow | null);
    const payments = ((payRes.data as PaymentRow[] | null) ?? []).map(mapPayment);

    return { plan, usage, payments };
  },
);

function mapUsage(row: UsageRow | null): UsageView | null {
  if (!row) return null;

  const metrics: UsageMetricView[] = [];

  const add = (label: string, used: unknown, limit: unknown) => {
    const u = num(used);
    if (u == null) return;
    metrics.push({ label, used: u, limit: num(limit) });
  };

  add("Assets generated", row.assets_generated, row.assets_limit);
  add("Reports downloaded", row.reports_downloaded, row.reports_limit);
  add("API calls", row.api_calls_used, row.api_calls_limit);

  const start = formatDate(row.period_start);
  const end = formatDate(row.period_end);
  const periodLabel = start && end ? `${start} – ${end}` : (start ?? end);

  if (metrics.length === 0 && !periodLabel) return null;

  return { periodLabel, metrics };
}

function mapPayment(row: PaymentRow): PaymentRowView {
  const dateLabel = formatDate(row.paid_at ?? row.failed_at ?? row.created_at);
  const naira = koboToNaira(row.amount_kobo);
  return {
    id: row.id,
    dateLabel,
    description:
      row.status?.toLowerCase() === "failed" && row.failure_reason
        ? `Payment failed — ${row.failure_reason}`
        : "Subscription payment",
    amountLabel: formatNaira(naira),
    status: paymentStatus(row.status),
  };
}
