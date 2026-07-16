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

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;
  // Internal callers send CRON_SECRET (cron/orchestrator); the Next.js server
  // action (first scan after onboarding) sends the service-role key instead
  // (docs/env-vars.md: the app holds the service-role key, not CRON_SECRET).
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const fromServer = bearer.length > 0 && bearer === SERVICE_ROLE_KEY();
  if (!isAuthorizedInternal(req) && !fromServer) {
    return json({ error: "unauthorized" }, 401);
  }

  const sb = serviceClient();

  let body: { scan_job_id?: string; brand_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json body" }, 400);
  }
  const scanJobId = body.scan_job_id;
  const brandId = body.brand_id;
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
    await setScanStatus(sb, scanJobId, "running", {
      expected_modules: modules as string[],
      started_at: new Date().toISOString(),
      progress_percentage: 0,
    });

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

    // 4. For each module: enqueue (durable) AND directly invoke the researcher.
    // A brand with zero competitors still fans out — competitor-dependent modules
    // no-op gracefully (data-flow-rules.md §4 partial handling).
    for (const task of modules) {
      const msg: ScanModuleMessage = { ...base, task_type: task };
      await enqueueModule(sb, msg);
      await invokeFunction(MODULE_FUNCTION[task], msg);
    }

    // 5. Return immediately — do NOT wait. Researchers drive completion →
    // synthesis via completeModule.
    return json({ ok: true, modules: modules.length });
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
