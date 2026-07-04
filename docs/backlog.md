# Backlog — owner-approved priorities (2026-07-04)

Reviewed with the owner after assessing three external documents (an AEO playbook
sales page; Gemini- and OpenAI-generated SaaS blueprints) plus the "1% founder"
activation discussion. **Strategic conclusion: no change of direction.** Both AI
blueprints independently converged on the architecture Brandscope already has
(evidence-first scoring, cheap-model parsing, weekly sampled monitoring,
pgvector, queues, no custom crawlers) and neither conceived of our moat —
regulatory intelligence, market-specific knowledge, executable assets. The moat
is vertical depth; keep investing there.

Everything below is **approved for build, in this order**, and is still subject
to the scope gate (`docs/skills/mvp-constraints.md`) at implementation time.
Nothing here overrides the MVP hard exclusions.

---

## Gate 0 — pipeline first (blocks everything)

The scan pipeline has never completed end-to-end. No feature below gets built
until it has.

- [ ] **Owner:** set the `CRON_SECRET` Edge Function secret (Dashboard → Edge
      Functions → Secrets; value = Vault `cron_secret`). Diagnosed 2026-07-04:
      the secret was never created, so every cron → function and
      function → function call 401s.
- [ ] Re-kick the stuck Betvita scan job (`scan_jobs` status `failed`,
      "Missing required environment variable: CRON_SECRET") and watch a full
      run: 8 modules → synthesis → cache-population → dashboard.
- [ ] Remove the temporary `ops-kick-scan` Edge Function + `app_get_cron_secret`
      SQL helper — OR formalize re-kick as an internal-admin tool (decide with
      owner). They exist only in Supabase, not in the repo; do not leave them
      undocumented.

## P1 — Activation (from the 1%-founder discussion)

Acquisition/retention mechanics before feature depth; we have zero customers.

1. **Real scanning screen.** Stream actual per-module findings while the first
   scan runs (wire `StatusPoller`/checklist to `scan_jobs.completed_steps` and
   early cache rows) instead of the timed fake checklist. The 2–3 minute wait
   becomes the product demo. Honest: real data only, streamed as it lands.
2. **Funnel instrumentation.** Define activation = *user views first action plan
   AND opens one evidence link*. Log wizard step events, drop-offs,
   agent-suggestion acceptance rate, scan completion time into `usage_metrics`.
3. **Taste before signup.** Move the domain-analysis step ahead of account
   creation (landing page → detected markets/competitors → "create account to
   run the full scan"). Small auth rework; biggest conversion lever.
4. **Shareable insight card.** One auto-generated, Brandscope-branded card per
   scan (brand vs top rival, one damning metric); tap to download/share.
5. **First-week alert moment.** Ensure the first between-cycle competitor change
   lands loudly in-app. (Email/WhatsApp delivery stays excluded at MVP; revisit
   — an alert nobody sees doesn't retain. Related: scanning-screen copy says
   "We'll email you when ready" but email is excluded — reword or descope.)

## P2 — GEO hardening (synthesis of all three external docs)

1. **Brand Fact Base + AI hallucination alerts** *(marquee feature)*. Store
   verified brand facts at onboarding (licence/regulator, welcome bonus,
   markets, features; owner-editable in admin). Weekly GEO probe outputs get a
   claim-checking pass (Haiku): decompose answers about the brand into claims,
   flag wrong/unsupported ones ("Gemini misquotes your welcome bonus",
   "ChatGPT says you're unlicensed in Nigeria"). For iGaming this is a
   compliance event, not a vanity metric — and no competitor serving African
   iGaming has it. Schema sketch: `verified_facts` (jsonb on brands or its own
   table) + `ai_claims` (claim_text, claim_type, support_status,
   hallucination_flag, evidence). New alert type rides existing alert infra.
2. **Honest sampling.** (a) Show sample size on the GEO score — "based on N
   prompts across 4 engines this week". (b) Run high-value commercial prompts
   3× per engine and report citation *rate*, not a boolean (~3× that module's
   LLM cost; AI answers are non-deterministic — all three docs flag one-shot
   probes as the #1 credibility risk).
3. **Google AI Overviews as 5th surface.** DataForSEO (existing provider)
   exposes AIO blocks via SERP API. Track presence, cited domains, brand
   in/out. Rounds out the platform story where zero-click loss actually bites.
4. **Richer mention taxonomy** *(nearly free — prompt change)*: direct
   recommendation / neutral / negative / incorrect / comparison-only /
   citation-only / competitor-only / absent, replacing binary mention+sentiment
   in the GEO structurer.
5. **Prompt-library expansion** *(nearly free — template rows)*: add
   *alternatives* ("best alternatives to [competitor]") and *trust*
   ("is [brand] reliable?") intents to `geo_query_templates`.
6. **GEO citation-loss alert**: "competitor gained a citation for a query you
   previously appeared in" as a between-cycle alert type.

## P2b — Founder HQ / back-office (owner-requested 2026-07-04; upgraded after
## the Backoffice advisory review)

The internal HQ Agent (built: /brandscope-admin/chat, tool-calling v2) answers
from brands/revenue/operations/agents/users TODAY. Build order below; each new
module becomes a new agent tool.

1. **Provider cost & usage attribution** *(top item — belongs right after
   Gate 0: instrumentation only collects forward, every un-instrumented scan is
   unit-economics data lost)*. Instrument the three shared API clients
   (dataforseo/detectzestack/llm in supabase/functions/_shared) to write one row
   per provider call: vendor, endpoint, brand_id, scan_job_id, module, status,
   latency_ms, units, estimated_cost (per-endpoint price table, flagged as
   estimate). Powers: the EXISTING API-health cards (api_health_logs, currently
   writer-less), vendor cost breakdown, per-brand cost, margin report, and two
   new HQ tools (cost_breakdown, vendor_failures). LLM calls are already fully
   attributed via agent_job_logs (Rule 4) — this closes the non-LLM half.
2. **HQ Chat quick wins:** one-click saved briefings (Daily Founder Briefing /
   Weekly Ops / Monthly Margin — canned prompts over existing tools) +
   "suggested action" line in answers (prompt tweak).
3. **Per-brand consumption & margin report** (internal screen, after item 1 has
   data): plan revenue vs attributed cost (LLM + providers), usage by module,
   failed-job cost, margin %; company-wide rollup = unit-economics view.
4. **Consumption alerts** (rides between-cycle monitor): brand cost > threshold,
   margin < 50%, vendor failure-rate spike, 5x usage anomaly.
5. **Marketing initiatives tracker** — Brandscope's own campaigns/channels/spend
   (new internal table + admin CRUD). Agent tool: marketing_summary.
6. **Customer support / CRM** — decide: integrate (shared inbox / HubSpot-class
   tool) vs. minimal in-app support-tickets table. Agent tool: support_queue.
7. **CMS** — Brandscope's own content/blog. Likely external platform at this
   stage; revisit when content marketing starts. Agent tool: content_status.

Rejected from the Backoffice advisory (revisit only at scale): credit ledger
(flat-tier pricing has no credits), 23-screen chat/consumption sprawl (one chat
+ one report screen suffice), data warehouse / semantic metrics layer, HQ role
tiers + Act mode (single-operator company; needs confirmation infra when hired).

## P3 — Smaller approved items

- **Copy audit (defensive, ~1h):** never claim "rank on ChatGPT" anywhere —
  measurement language only ("appears in / cited by sampled AI answers").
- **robots.txt AI-crawler check:** flag if the brand blocks `GPTBot`,
  `OAI-SearchBot`, `PerplexityBot`, `Google-Extended` (one HTTP request; a
  brand blocking AI crawlers can never be cited). Natural home: tech-stack or
  GEO module; killer "fix this today" recommendation.
- **GEO fix taxonomy:** map GEO recommendations to fix categories (answer
  formatting, entity consistency, schema, third-party citations, freshness) so
  "you're absent from X" always prescribes *which* fix. Gotcha to encode:
  Google removed FAQ rich results — FAQ schema may be recommended for LLM
  comprehension, never as a Google rich-result tactic.
- **Regulatory coverage expansion:** markets went global (2026-07) but the
  regulator corpus covers nigeria/kenya/south_africa. Selection-time "limited
  coverage" hints ship already; expanding corpus per market is demand-driven —
  prioritize by what markets real signups select.
- **Cost note for GEO economics:** Claude web-search API ≈ $10/1k searches on
  top of tokens; keep probe volume budgeted per plan tier.

## Explicitly rejected (from the external docs — do not build)

Horizontal SEO-suite surface: site crawler, GSC/GA4 OAuth integrations,
backlink intelligence, technical SEO audits, CMS publishing, browser-automation
scraping of AI UIs, SSO/enterprise features, "one-click GEO optimization",
"guaranteed AI ranking" claims. The failure mode both blueprints warn about is
becoming a weak Semrush clone; our answer is vertical depth, not surface area.
