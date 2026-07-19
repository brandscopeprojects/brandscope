// DataForSEO spend metering + per-org cost cap (migration 17; owner decision
// 2026-07-19). Two jobs:
//   1. METER — capture the `cost` DataForSEO returns on every response and
//      attribute it to the running (org, brand, scan_job, module). Uses an
//      AsyncLocalStorage store so concurrent module invocations sharing one warm
//      isolate never co-mingle their costs.
//   2. CAP — before a scan spends, check the org's daily spend vs its cap and the
//      account balance vs a floor; brand-scan hard-fails the scan when tripped.
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

type MeterStore = { costUsd: number; ctx: MeterCtx | null };

const spendStore = new AsyncLocalStorage<MeterStore>();

/** Add a DataForSEO response `cost` to the running module's tally (no-op off-context). */
export function addSpend(cost: unknown): void {
  const s = spendStore.getStore();
  if (!s) return;
  const n = typeof cost === "number" ? cost : Number(cost);
  if (Number.isFinite(n) && n > 0) s.costUsd += n;
}

/** Called inside a researcher once the message is parsed, to attribute later spend. */
export function setMeterCtx(ctx: MeterCtx): void {
  const s = spendStore.getStore();
  if (s) s.ctx = ctx;
}

/**
 * Wrap a request handler so all DataForSEO spend during the request is captured
 * and persisted once when it settles (success OR error). Establishes the ALS
 * store; the handler calls setMeterCtx() after it knows the org/brand/job.
 */
export function withMeter(
  handler: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return (req: Request) => {
    const store: MeterStore = { costUsd: 0, ctx: null };
    return spendStore.run(store, async () => {
      try {
        return await handler(req);
      } finally {
        if (store.ctx) {
          await recordProviderSpend(store.ctx, store.costUsd).catch(() => {});
        }
      }
    });
  };
}

/** Persist a module's spend: one provider_spend row + atomic scan cost rollup. */
export async function recordProviderSpend(ctx: MeterCtx, costUsd: number): Promise<void> {
  if (!(costUsd > 0)) return; // nothing spent (all-cached module, or non-DFS module)
  const sb = ctx.sb;
  try {
    await sb.from("provider_spend").insert({
      organisation_id: ctx.organisation_id,
      brand_id: ctx.brand_id,
      scan_job_id: ctx.scan_job_id,
      task_type: ctx.task_type,
      provider: "dataforseo",
      cost_usd: costUsd,
    });
  } catch (_e) {
    // metering must never break a scan
  }
  if (ctx.scan_job_id) {
    try {
      await sb.rpc("app_increment_scan_cost", { p_scan_job_id: ctx.scan_job_id, p_delta: costUsd });
    } catch (_e) {
      // non-fatal
    }
  }
}

type BudgetConfig = { daily_cap_usd: number; balance_floor_usd: number; enabled: boolean };

/** Resolve the org-specific budget row, else the global default (org_id NULL). */
async function loadBudgetConfig(
  sb: SupabaseClient,
  organisationId: string | null,
): Promise<BudgetConfig | null> {
  try {
    const { data } = await sb
      .from("provider_budget_config")
      .select("organisation_id, daily_cap_usd, balance_floor_usd, enabled")
      .eq("provider", "dataforseo")
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

/** Today's (UTC) DataForSEO spend for an org, summed from provider_spend. */
async function spendToday(sb: SupabaseClient, organisationId: string | null): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    let q = sb
      .from("provider_spend")
      .select("cost_usd")
      .eq("provider", "dataforseo")
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
  dailyCap: number;
  balanceFloor: number;
  spentToday: number;
  liveBalance: number | null;
};

/**
 * Decide whether a spending scan may proceed for this org. Two gates:
 *   - account balance below the floor  → block (protects the shared wallet)
 *   - org's spend today at/over the cap → block (per-org runaway protection)
 * Fail-open: if config is missing/disabled or reads fail, scanning proceeds — the
 * cap is a guardrail, not a new single point of failure.
 */
export async function checkBudget(
  sb: SupabaseClient,
  args: { organisationId: string | null; liveBalance: number | null },
): Promise<BudgetVerdict> {
  const cfg = await loadBudgetConfig(sb, args.organisationId);
  const base = {
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

  const spent = await spendToday(sb, args.organisationId);
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
