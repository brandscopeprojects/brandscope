// brand-scan — Supervisor decompose step (agent-orchestration.md §"End-to-end
// sequence" step 2). Invoked per pending job with `{ scan_job_id, brand_id }` and
// `Authorization: Bearer ${CRON_SECRET}` (cron/orchestrator) or the service-role
// key (Next.js server action kicking the first scan after onboarding). Loads the brand's context, computes its
// enabled modules, records the expected fan-out on scan_jobs, transitions the job
// to `running`, then for each module both enqueues a durable scan_modules message
// AND directly invokes the researcher function (researchers process from the POST
// body). It does NOT wait for modules — completion → synthesis is driven by the
// researchers via completeModule when the fan-out finishes.

import { serviceClient } from "../_shared/supabase.ts";
import { json, preflight, isAuthorizedInternal, isServiceBearer } from "../_shared/http.ts";
import { SERVICE_ROLE_KEY } from "../_shared/env.ts";
import {
  enabledModules,
  setScanStatus,
  enqueueModule,
  invokeFunction,
} from "../_shared/scan.ts";
import { MODULE_FUNCTION, MVP_MODULES, type CompetitorRef, type ScanModuleMessage } from "../_shared/contracts.ts";

// Module → its cache table. A module is "fresh" when that table already holds a
// row for this (brand, scan_week). tech_stack_cache has no brand_id (keyed by
// competitor), so it is checked via the brand's competitor ids.
const CACHE_TABLE_BY_MODULE: Record<string, { table: string; byCompetitor?: boolean }> = {
  traffic_seo: { table: "seo_cache" },
  geo_aeo: { table: "geo_cache" },
  promotions: { table: "promotions_cache" },
  customer: { table: "customer_intel_cache" },
  regulatory: { table: "regulatory_cache" },
  hiring: { table: "hiring_signals_cache" },
  app_store: { table: "product_intel_cache" },
  tech_stack: { table: "tech_stack_cache", byCompetitor: true },
};

/** Subset of `modules` whose cache already has data for this (brand, scan_week). */
async function modulesWithFreshCache(
  sb: ReturnType<typeof serviceClient>,
  brandId: string,
  scanWeek: string,
  modules: string[],
  competitorIds: string[],
): Promise<Set<string>> {
  const fresh = new Set<string>();
  await Promise.all(
    modules.map(async (m) => {
      const meta = CACHE_TABLE_BY_MODULE[m];
      if (!meta) return; // unknown module → never skip (safe default: re-run)
      try {
        let q = sb.from(meta.table).select("*", { count: "exact", head: true }).eq("scan_week", scanWeek);
        if (meta.byCompetitor) {
          if (competitorIds.length === 0) return; // nothing to check → run it
          q = q.in("competitor_id", competitorIds);
        } else {
          q = q.eq("brand_id", brandId);
        }
        const { count } = await q;
        if ((count ?? 0) > 0) fresh.add(m);
      } catch (_e) {
        // any read problem → treat as not-fresh (safe: we re-fetch rather than skip)
      }
    }),
  );
  return fresh;
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  // Internal callers send CRON_SECRET (cron/orchestrator); the Next.js server
  // action (first scan after onboarding) sends the service-role key instead
  // (docs/env-vars.md: the app holds the service-role key, not CRON_SECRET).
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  // App calls may carry the legacy service_role JWT (string match) OR a newer
  // sb_secret key (validated live via isServiceBearer — string match is impossible).
  const fromServer =
    bearer.length > 0 && (bearer === SERVICE_ROLE_KEY() || (await isServiceBearer(bearer)));
  if (!isAuthorizedInternal(req) && !fromServer) {
    return json({ error: "unauthorized" }, 401);
  }

  const sb = serviceClient();

  let body: { scan_job_id?: string; brand_id?: string; force_refresh?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json body" }, 400);
  }
  const scanJobId = body.scan_job_id;
  const brandId = body.brand_id;
  const forceRefresh = body.force_refresh === true;
  if (!scanJobId || !brandId) {
    return json({ error: "scan_job_id and brand_id are required" }, 400);
  }

  try {
    // 1. Load the scan job (scoped to this brand for isolation).
    const { data: job, error: jobError } = await sb
      .from("scan_jobs")
      .select("id, brand_id, scan_week, status")
      .eq("id", scanJobId)
      .eq("brand_id", brandId)
      .single();
    if (jobError || !job) {
      return json({ error: `scan job not found: ${jobError?.message ?? "missing"}` }, 404);
    }

    // 1b. Load the brand.
    const { data: brand, error: brandError } = await sb
      .from("brands")
      .select("id, name, domain, market, tier, industry")
      .eq("id", brandId)
      .single();
    if (brandError || !brand) {
      throw new Error(`load brand: ${brandError?.message ?? "missing"}`);
    }

    // 1b-self. Ensure a self-competitor row exists for the brand's OWN domain so the
    // per-competitor module caches (seo/promotions/tech/customer…) can carry the
    // brand's own data — the dashboard's own-brand reach/SOV/threat read from it.
    // The self row is a shared `competitors` record keyed by domain; it is
    // DELIBERATELY NOT linked via brand_competitors, so it never appears in the
    // brand's competitor list (getBrandCompetitors) or as a grey rival dot.
    // cache-population resolves it by a direct domain match.
    const { data: selfComp } = await sb
      .from("competitors")
      .upsert(
        {
          domain: brand.domain,
          name: brand.name,
          tier: brand.tier,
          industry: brand.industry,
          primary_market: brand.market?.[0] ?? null,
        },
        { onConflict: "domain" },
      )
      .select("id, name, domain, tier")
      .single();

    // 1c. Load brand preferences (gates which modules run).
    const { data: prefs } = await sb
      .from("brand_preferences")
      .select("*")
      .eq("brand_id", brandId)
      .maybeSingle();

    // 1d. Resolve the brand's tracked competitors (brand_competitors → competitors).
    const { data: links } = await sb
      .from("brand_competitors")
      .select("competitor_id, priority")
      .eq("brand_id", brandId)
      .order("priority", { ascending: true });

    let competitors: CompetitorRef[] = [];
    if (links && links.length > 0) {
      const ids = links.map((l) => l.competitor_id);
      const { data: comps } = await sb
        .from("competitors")
        .select("id, name, domain, tier")
        .in("id", ids);
      const byId = new Map((comps ?? []).map((c) => [c.id, c]));
      competitors = links
        .map((l) => {
          const c = byId.get(l.competitor_id);
          if (!c) return null;
          return { id: c.id, name: c.name, domain: c.domain, tier: c.tier } satisfies CompetitorRef;
        })
        .filter((c): c is CompetitorRef => c !== null);
    }

    // Prepend the brand's self-competitor so researchers scan the brand's OWN
    // domain too (deduped — skip if a tracked competitor already shares the id).
    if (selfComp && !competitors.some((c) => c.id === selfComp.id)) {
      competitors = [
        { id: selfComp.id, name: selfComp.name, domain: selfComp.domain, tier: selfComp.tier },
        ...competitors,
      ];
    }

    // Kill switches (Agent Control): supervisor pauses the whole scan; researcher
    // can be paused wholesale or per module (agents.config.disabled_modules).
    // Fail-safe: any read problem → everything runs.
    let disabledModules: string[] = [];
    try {
      const { data: agentRows } = await sb.from("agents").select("name, status, config");
      const byName = new Map((agentRows ?? []).map((a) => [a.name, a]));
      if (byName.get("supervisor")?.status === "inactive") {
        await setScanStatus(sb, scanJobId, "failed", {
          error_message: "paused by supervisor kill switch",
          completed_at: new Date().toISOString(),
        });
        return json({ ok: false, error: "paused by supervisor kill switch" }, 409);
      }
      const researcher = byName.get("researcher");
      if (researcher?.status === "inactive") {
        disabledModules = [...MVP_MODULES];
      } else {
        const cfg = (researcher?.config ?? {}) as { disabled_modules?: unknown };
        if (Array.isArray(cfg.disabled_modules)) {
          disabledModules = cfg.disabled_modules.map((m) => String(m));
        }
      }
    } catch (_e) {
      disabledModules = [];
    }

    // 2. Compute enabled modules; record expected fan-out + transition to running.
    const modules = enabledModules(prefs as Record<string, unknown> | null).filter(
      (m) => !disabledModules.includes(m),
    );
    if (modules.length === 0) {
      await setScanStatus(sb, scanJobId, "partial", {
        error_message: "all modules paused by kill switches",
        completed_at: new Date().toISOString(),
      });
      return json({ ok: false, error: "all modules paused by kill switches" }, 409);
    }
    // 2b. SKIP-IF-FRESH (cost control): a module whose cache already holds data
    // for this (brand, scan_week) does NOT need to re-hit DataForSEO — re-scans
    // and DLQ retries were re-buying data we already own. Only modules WITHOUT
    // fresh cache get dispatched. `force_refresh` overrides (deliberate re-fetch).
    const competitorIds = competitors.map((c) => c.id);
    const freshModules = forceRefresh
      ? new Set<string>()
      : await modulesWithFreshCache(sb, brandId, job.scan_week, modules, competitorIds);
    const toRun = modules.filter((m) => !freshModules.has(m));

    // 3. Shared message base for every module.
    const base = {
      scan_job_id: scanJobId,
      brand_id: brandId,
      brand_domain: brand.domain,
      brand_name: brand.name,
      scan_week: job.scan_week,
      markets: brand.market,
      competitors,
    };

    // All modules already fresh → skip every researcher (zero DataForSEO spend)
    // and go straight to synthesis, which regenerates the plan from cached data.
    if (toRun.length === 0) {
      await setScanStatus(sb, scanJobId, "running", {
        expected_modules: [] as string[],
        started_at: new Date().toISOString(),
        progress_percentage: 50,
      });
      invokeFunction("synthesis-draft-audit", {
        scan_job_id: scanJobId,
        brand_id: brandId,
        scan_week: job.scan_week,
      });
      return json({ ok: true, modules: 0, skipped_fresh: modules.length });
    }

    await setScanStatus(sb, scanJobId, "running", {
      expected_modules: toRun as string[],
      started_at: new Date().toISOString(),
      progress_percentage: 0,
    });

    // 4. For each module that needs fresh data: enqueue (durable) AND directly
    // invoke the researcher. Fresh modules are skipped — cache-population reads
    // ALL cache tables for (brand, week), so their existing data still flows in.
    for (const task of toRun) {
      const msg: ScanModuleMessage = { ...base, task_type: task };
      await enqueueModule(sb, msg);
      await invokeFunction(MODULE_FUNCTION[task], msg);
    }

    // 5. Return immediately — do NOT wait. Researchers drive completion →
    // synthesis via completeModule.
    return json({ ok: true, modules: toRun.length, skipped_fresh: modules.length - toRun.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Fatal decomposition failure → mark the job failed (auto-retry handled by the
    // 06:00 monitor per agent-orchestration.md).
    await setScanStatus(sb, scanJobId, "failed", {
      error_message: message,
      completed_at: new Date().toISOString(),
    });
    return json({ ok: false, error: message }, 500);
  }
});
