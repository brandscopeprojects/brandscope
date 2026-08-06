// Provider spend metering + per-org cost caps (migration 17; extended 2026-08-06
// to cover LLM/other providers, not just DataForSEO). Two jobs:
//   1. METER — capture each provider's cost during a request and attribute it to
//      the running (org, brand, scan_job, module). Uses an AsyncLocalStorage store
//      keyed by provider so concurrent module invocations sharing one warm isolate
//      never co-mingle their costs. DataForSEO cost comes from its response `cost`;
//      LLM cost comes from token usage priced in llm.ts (addProviderSpend).
//   2. CAP — before a scan spends, check the org's daily spend vs its cap (per
//      provider) and, for DataForSEO, the account balance vs a floor; brand-scan
//      hard-fails the scan when tripped.
//
// This module deliberately does NOT import dataforseo.ts (dataforseo.ts imports
// addSpend from here) — the live-balance fetch lives in dataforseo.ts and its
// value is passed into checkBudget, so there is no import cycle.

import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "./supabase.ts";

export type MeterCtx = {
  sb: SupabaseClient;
  organisation_id: string | null;
  brand_id: string | null;
  scan_job_id: string | null;
  task_type: string | null;
};

// Per-provider running tally for the current request (provider → USD).
type MeterStore = { costs: Map<string, number>; ctx: MeterCtx | null };

const spendStore = new AsyncLocalStorage<MeterStore>();

/** Attribute `cost` to a provider on the running module's tally (no-op off-context). */
export function addProviderSpend(provider: string, cost: unknown): void {
  const s = spendStore.getStore();
  if (!s) return;
  const n = typeof cost === "number" ? cost : Number(cost);
  if (Number.isFinite(n) && n > 0) s.costs.set(provider, (s.costs.get(provider) ?? 0) + n);
}

/** DataForSEO convenience wrapper (dataforseo.ts calls this on every response). */
export function addSpend(cost: unknown): void {
  addProviderSpend("dataforseo", cost);
}

/** Called inside a researcher once the message is parsed, to attribute later spend. */
export function setMeterCtx(ctx: MeterCtx): void {
  const s = spendStore.getStore();
  if (s) s.ctx = ctx;
}

/**
 * Wrap a request handler so all provider spend during the request is captured and
 * persisted once when it settles (success OR error). Establishes the ALS store;
 * the handler calls setMeterCtx() after it knows the org/brand/job.
 */
export function withMeter(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return (req: Request) => {
    const store: MeterStore = { costs: new Map(), ctx: null };
    return spendStore.run(store, async () => {
      try {
        return await handler(req);
      } finally {
        if (store.ctx) {
          await recordProviderSpend(store.ctx, store.costs).catch(() => {});
        }
      }
    });
  };
}

/** Persist a module's spend: one provider_spend row PER provider + scan cost rollup. */
export async function recordProviderSpend(ctx: MeterCtx, costs: Map<string, number>): Promise<void> {
  const entries = [...costs.entries()].filter(([, c]) => c > 0);
  if (entries.length === 0) return; // nothing spent (all-cached module)
  const sb = ctx.sb;
  try {
    await sb.from("provider_spend").insert(
      entries.map(([provider, cost_usd]) => ({
        organisation_id: ctx.organisation_id,
        brand_id: ctx.brand_id,
        scan_job_id: ctx.scan_job_id,
        task_type: ctx.task_type,
        provider,
        cost_usd,
      })),
    );
  } catch (_e) {
    // metering must never break a scan
  }
  const total = entries.reduce((s, [, c]) => s + c, 0);
  if (ctx.scan_job_id && total > 0) {
    try {
      await sb.rpc("app_increment_scan_cost", { p_scan_job_id: ctx.scan_job_id, p_delta: total });
    } catch (_e) {
      // non-fatal
    }
  }
}

type BudgetConfig = { daily_cap_usd: number; balance_floor_usd: number; enabled: boolean };

/** Resolve the org-specific budget row for a provider, else the global default (org_id NULL). */
async function loadBudgetConfig(
  sb: SupabaseClient,
  provider: string,
  organisationId: string | null,
): Promise<BudgetConfig | null> {
  try {
    const { data } = await sb
      .from("provider_budget_config")
      .select("organisation_id, daily_cap_usd, balance_floor_usd, enabled")
      .eq("provider", provider)
      .or(`organisation_id.eq.${organisationId ?? "00000000-0000-0000-0000-000000000000"},organisation_id.is.null`);
    const rows = (data ?? []) as Array<{ organisation_id: string | null } & BudgetConfig>;
    // Prefer the org-specific row over the global default.
    const specific = rows.find((r) => r.organisation_id === organisationId && organisationId != null);
    const global = rows.find((r) => r.organisation_id == null);
    const row = specific ?? global;
    if (!row) return null;
    return {
      daily_cap_usd: Number(row.daily_cap_usd),
      balance_floor_usd: Number(row.balance_floor_usd),
      enabled: Boolean(row.enabled),
    };
  } catch (_e) {
    return null; // fail-open: a config read problem must not block scanning
  }
}

/** Today's (UTC) spend for a provider+org, summed from provider_spend. */
async function spendToday(sb: SupabaseClient, provider: string, organisationId: string | null): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    let q = sb
      .from("provider_spend")
      .select("cost_usd")
      .eq("provider", provider)
      .eq("spend_date", today);
    q = organisationId == null ? q.is("organisation_id", null) : q.eq("organisation_id", organisationId);
    const { data } = await q;
    return (data ?? []).reduce((sum, r) => sum + Number((r as { cost_usd: number }).cost_usd || 0), 0);
  } catch (_e) {
    return 0; // fail-open
  }
}

export type BudgetVerdict = {
  allowed: boolean;
  reason?: string;
  provider: string;
  dailyCap: number;
  balanceFloor: number;
  spentToday: number;
  liveBalance: number | null;
};

/**
 * DataForSEO gate: account balance below the floor OR org spend today at/over the
 * cap → block. Fail-open: missing/disabled config or read errors never block.
 */
export async function checkBudget(
  sb: SupabaseClient,
  args: { organisationId: string | null; liveBalance: number | null },
): Promise<BudgetVerdict> {
  const cfg = await loadBudgetConfig(sb, "dataforseo", args.organisationId);
  const base = {
    provider: "dataforseo",
    dailyCap: cfg?.daily_cap_usd ?? 0,
    balanceFloor: cfg?.balance_floor_usd ?? 0,
    spentToday: 0,
    liveBalance: args.liveBalance,
  };
  if (!cfg || !cfg.enabled) return { allowed: true, ...base };

  if (args.liveBalance != null && args.liveBalance < cfg.balance_floor_usd) {
    return {
      allowed: false,
      reason: `DataForSEO balance $${args.liveBalance.toFixed(2)} is below the $${cfg.balance_floor_usd} floor`,
      ...base,
    };
  }

  const spent = await spendToday(sb, "dataforseo", args.organisationId);
  if (spent >= cfg.daily_cap_usd) {
    return {
      allowed: false,
      reason: `organisation daily DataForSEO spend $${spent.toFixed(2)} has reached the $${cfg.daily_cap_usd} cap`,
      ...base,
      spentToday: spent,
    };
  }
  return { allowed: true, ...base, spentToday: spent };
}

/**
 * Generic daily-cap gate for a single provider (no live-balance floor — used for
 * LLM/other providers we can't balance-query). Blocks when today's recorded org
 * spend for the provider is at/over its daily cap. Fail-open on missing config.
 */
export async function checkDailyCap(
  sb: SupabaseClient,
  provider: string,
  organisationId: string | null,
): Promise<{ allowed: boolean; reason?: string; provider: string; dailyCap: number; spentToday: number }> {
  const cfg = await loadBudgetConfig(sb, provider, organisationId);
  if (!cfg || !cfg.enabled) {
    return { allowed: true, provider, dailyCap: cfg?.daily_cap_usd ?? 0, spentToday: 0 };
  }
  const spent = await spendToday(sb, provider, organisationId);
  if (spent >= cfg.daily_cap_usd) {
    return {
      allowed: false,
      reason: `organisation daily ${provider} spend $${spent.toFixed(2)} has reached the $${cfg.daily_cap_usd} cap`,
      provider,
      dailyCap: cfg.daily_cap_usd,
      spentToday: spent,
    };
  }
  return { allowed: true, provider, dailyCap: cfg.daily_cap_usd, spentToday: spent };
}
