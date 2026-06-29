# Scoring Formulas — Exact Coefficients

**Check before:** the cache-population step (Sprint 3, step 26) and any dashboard chart that renders a score.
All scores 0–100 unless noted. Reference constants are v1 defaults, tunable later via internal admin — but they live **only here**; never inline a coefficient elsewhere.
`clamp(x,lo,hi)` bounds a value. `norm` = normalised to 0–100. `pos(x)=clamp(x,0,100)`.

---

## 1. reach_score (Market Position Map X-axis) — per competitor & brand
```
reach_score = 0.50*traffic_norm + 0.30*keyword_norm + 0.20*sov_pct
  traffic_norm = clamp(100 * log10(est_monthly_traffic+1) / log10(REACH_TRAFFIC_REF), 0, 100)
  keyword_norm = clamp(100 * organic_keyword_count / REACH_KEYWORD_REF, 0, 100)
  sov_pct      = entity share-of-voice % (see §4)
```
Constants: `REACH_TRAFFIC_REF = 5,000,000` · `REACH_KEYWORD_REF = 50,000`
Sources: DataForSEO `bulk_traffic_estimation`, `keywords_for_site`.

## 2. aggression_score (Market Position Map Y-axis) — MVP-available signals only
```
aggression_score = 0.35*paid_traffic_norm + 0.25*adtech_norm + 0.25*promo_activity_norm + 0.15*bonus_kw_norm
  paid_traffic_norm   = clamp(paid_traffic_pct, 0, 100)                          (DataForSEO organic/paid split)
  adtech_norm         = clamp(100 * ad_network_count / AGG_ADNET_REF, 0, 100)    (DetectZeStack)
  promo_activity_norm = clamp(100 * promo_signal_count / AGG_PROMO_REF, 0, 100)  (promotions_cache signals)
  bonus_kw_norm       = clamp(100 * bonus_keyword_movement / AGG_BONUSKW_REF, 0, 100) (Keywords Data)
```
Constants: `AGG_ADNET_REF = 5` · `AGG_PROMO_REF = 10` · `AGG_BONUSKW_REF = 100`
Note: active-ad volume (Apify) is excluded at MVP — not used here until Phase 2.

## 3. threat_score (Threat Gauge) — brand-relative, aggregated over tracked competitors
```
per_threat(c) = 0.40*pos(c.aggression − brand.aggression)
              + 0.30*pos(c.promo_activity_norm − brand.promo_activity_norm)
              + 0.20*pos(c.reach_score − brand.reach_score)
              + 0.10*pos(c.ai_visibility − brand.ai_visibility)
threat_score = 0.60*max_c per_threat(c) + 0.40*mean_c per_threat(c)
```
Only competitors ahead of us add threat (`pos()` floors at 0).
threat_level: **<40 low · 40–59 medium · 60–79 high · ≥80 critical**
threat_reasons: top 2–3 contributing terms, rendered as one-liners beneath the gauge.

## 4. SOV (Share of Voice) — over the tracked set (brand + its competitors)
```
entity_sov_pct = 100 * entity_est_traffic / SUM(est_traffic over brand + all tracked competitors)
```
Stored: `weekly_cache.sov_pct` (brand), `competitor_profiles.sov_pct` (each).

## 5. AI Visibility Score (0–100) — 50/30/20 (confirmed)
```
ai_visibility_score = (mentions_ratio * 50) + (avg_sentiment * 30) + (avg_position * 20)
  mentions_ratio = (# query×platform checks where brand mentioned) / (total query×platform checks)   [0–1]
  avg_sentiment  = mean over mentions of {positive:1.0, neutral:0.5, negative:0.0}                    [0–1]
  avg_position   = mean over mentions of (11 − position)/10   (pos1→1.0 … pos10→0.1)                  [0–1]
```
MVP platforms in denominator: **ChatGPT, Claude, Gemini, Perplexity (4)**. Grok/Meta excluded.
`ai_visibility_trend = this_week − last_week`. Source: DataForSEO AI Optimization API.

## 6. Auditor composite — 40/30/20/10 (confirmed)
```
composite = 0.40*evidence_traceability + 0.30*brand_alignment + 0.20*logic_quality + 0.10*compliance
            (each sub-score 0.0–1.0 → composite 0.0–1.0)
```
Levels: **HIGH ≥0.80 · MEDIUM 0.50–0.79 · LOW 0.30–0.49 · REJECT <0.30**
URGENT gate: `composite ≥0.75 AND evidence_traceability ≥0.70 AND ≥2 evidence sources AND compliance = 1.0`
(fail any → downgrade urgency to WATCH).

## 7. Radar data (Competitive Radar, 6 axes 0–100) — brand vs market average
```
axes = { promotions: promo_activity_norm, traffic: traffic_norm, seo: keyword_norm,
         social: SOCIAL_AXIS, trust: trust_norm, engagement: ENGAGEMENT_AXIS }
  trust_norm = clamp(100 * (domain_authority/100 + avg_app_rating/5)/2, 0, 100)   (DataForSEO DA + App rating)
market_average polygon = mean of each axis across tracked competitors.
```
**MVP radar rule (important):** `SOCIAL_AXIS` and `ENGAGEMENT_AXIS` are Apify-dependent and **not available at MVP.** They render as **greyed-out axes labelled "Phase 2" in the UI — NOT as zero values.** Zero would collapse the polygon inward and distort the brand-vs-market shape. Store them as `NULL` in `weekly_cache.radar_data` and have the chart component render muted/greyed for null axes (never plot 0).

---

## 8. Competitor tier thresholds (Gap 3 — auto-detect + own-brand tier)
From DataForSEO `bulk_traffic_estimation` estimated **monthly visits**:
```
> 1,000,000          → dominant
100,000 – 1,000,000  → challenger
10,000 – 100,000     → mid_market
< 10,000             → niche
no data              → default 'challenger'
```
Tier is **editable** by the user (onboarding step 4 + `/admin/competitors`). Same heuristic sets the brand's own tier at onboarding. Writes `competitors.tier` / `brands.tier`. (Also documented in `mvp-module-sources.md` → Competitor Tier Detection.)

---

## Tuning
All `*_REF` constants, axis weights, threat bands, and tier thresholds are the single source of truth here.
Changing any score = edit this file (and, later, the internal-admin override). Never hardcode a coefficient in an Edge Function or component.
