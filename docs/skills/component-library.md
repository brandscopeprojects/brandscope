# Component Library — Canonical UI Components

**Check before:** building or modifying any frontend component or page.
**Pair with:** `ui-constraints.md` (design tokens, card anatomy, split-field) + `screen-specs.md` (which screen uses what).
**Rule:** build a component **once**, reuse everywhere. Never create a second variant of an existing component; extend props instead. Every component pulls colours/typography/spacing from the tokens in `ui-constraints.md` — no hardcoded hexes/fonts.

**Conventions:** `components/ui/*` = primitives & charts; `components/action/*` = action-feed; `components/intelligence/*` = page-specific; `components/mobile/*` = mobile variants; `components/admin/*` = admin. Charts use **Recharts** (Threat Gauge = custom SVG). All client-interactive components are Client Components; data comes from SSR props (no fetching inside).

---

## Core action-feed components

### `ActionCard` — `components/action/ActionCard.tsx`
The workhorse (used on ~11 screens). Renders the fixed card anatomy (`ui-constraints.md` §7).
- **Props:** `{ recommendation: Recommendation, onAccept, onSnooze, onDismiss, onGenerateAsset, defaultExpanded?: boolean }`
- **Tokens:** card surface `#FFFFFF`, sh1/sh2, radius 8–12px; urgency tag colours; Inter 600 headline; secondary `#6B6B78` trigger.
- **Composes:** `UrgencyTag`, `CategoryTag`, `ConfidenceBars`, `AssumptionCallout` (LOW/MED only), `EvidenceDrawer`, `GenerateAssetButton`, status controls.
- **Screens:** Dashboard(3), Competitor Profile(5), Promotions(6), Traffic/SEO(7), Ads&Spend(9), Product(10), Regulatory(12), GEO(14), Action Plan(15), + mobile.

### `EvidenceDrawer` — `components/action/EvidenceDrawer.tsx`
- **Props:** `{ evidence: EvidenceItem[], expanded, onToggle }`
- **Tokens:** JetBrains Mono for URL/timestamp/value; cobalt link; quote-styled block; faint `#9999A8`.
- **Order:** source URL → scrape timestamp → verbatim quote block → before/after. Collapsed by default.
- **Screens:** inside `ActionCard`; also Action Plan expanded rows.

### `ConfidenceBars` — `components/ui/ConfidenceBars.tsx`
- **Props:** `{ level: 'high'|'medium'|'low', score?: number }`
- **Tokens:** 3 filled/unfilled bars, green/amber/red. **Desktop = bars; mobile uses dots** (`components/mobile/ConfidenceDots.tsx`).

### `UrgencyTag` / `CategoryTag` — `components/ui/Tags.tsx`
- **Props:** `UrgencyTag { urgency: 'urgent'|'watch'|'opportunity'|'info' }` (solid bg + white text); `CategoryTag { category: string }` (neutral grey).

### `AssumptionCallout` — `components/action/AssumptionCallout.tsx`
- **Props:** `{ flags: string[] }` — amber inline chip, LOW/MED confidence only, above evidence toggle.

### `GenerateAssetButton` — `components/action/GenerateAssetButton.tsx`
- **Props:** `{ recommendationId, assetType, onResult }` — cobalt, full-width; triggers `POST /api/assets/generate`.

### `AssetGenerationResult` — `components/action/AssetGenerationResult.tsx`
- **Props:** `{ asset: GeneratedAsset, loading?: boolean }` — renders **inline below** the card (never a modal). Header (`CAMPAIGN BRIEF` + timestamp + New badge), sections, footer actions (Copy All / Edit / Save to Library / Share), loading "Writing your…" spinner.
- **Screens:** Asset Gen Result(32), Action Plan(15).

---

## Positioning / chart components (Dashboard)

### `ScatterMap` (Market Position Map) — `components/ui/ScatterMap.tsx`
- **Props:** `{ brand: Point, competitors: Point[], onCompetitorClick? }` — Recharts ScatterChart. X=reach, Y=aggression; faint quadrant labels (Dominants/Challengers/Established/Niche); **own brand = larger pulsing cobalt circle**; hover tooltip (traffic, SOV, threat). Screens: Dashboard(3), Market Intel(4), Brand Profile preview(20), mobile.

### `CompetitiveRadar` — `components/ui/CompetitiveRadar.tsx`
- **Props:** `{ brandPolygon: number[], marketAvg: number[], axes: string[] }` — Recharts RadarChart; cobalt fill 30% vs faint-red dashed market avg; 6 axes (Promotions/Traffic/SEO/Social/Trust/Engagement). Screen: Dashboard(3).

### `SOVDonut` — `components/ui/SOVDonut.tsx`
- **Props:** `{ brandSov: number, competitorSlices: Slice[] }` — Recharts PieChart; own slice cobalt; centre number in **Syne**. Screen: Dashboard(3).

### `ThreatGauge` — `components/ui/ThreatGauge.tsx`
- **Props:** `{ score: number, level: 'low'|'medium'|'high'|'critical', reasons: string[] }` — **custom SVG** arc green→amber→red; Syne score; 2–3 reasons listed beneath. Screens: Dashboard(3), Competitor Profile(5), mobile (`MobileGauge`).

### `FilterChips` — `components/ui/FilterChips.tsx`
- **Props:** `{ filters: {label, count, status}[], active, onChange }` — pill chips, low-opacity status tint, solid when active; live counts (All/Urgent/Watch/Opportunity[/Completed]). Screens: Dashboard(3), Action Plan(15), mobile(31).

---

## Intelligence-page components

### `AIVisibilityScore` — `components/intelligence/AIVisibilityScore.tsx`
- **Props:** `{ score: number, trend: number }` — hero Syne 800 cobalt N/100 + ↑/↓ trend. Screen: GEO(14), mobile.

### `PlatformBreakdownTable` — `components/intelligence/PlatformBreakdownTable.tsx`
- **Props:** `{ rows: PlatformRow[] }` — ChatGPT/Claude/Gemini/Perplexity (4 at MVP; Grok/Meta hidden/Phase 2): Mentioned / Sentiment / Position / Last Checked (mono). Screen: GEO(14).

### `ComplianceMatrix` — `components/intelligence/ComplianceMatrix.tsx`
- **Props:** `{ competitors: Row[], dimensions: string[], brandRow }` — green✓/amber⚠/red✗ across 6 dims + total; brand row cobalt highlight. Screen: Regulatory(12).

*(Additional page components — `StatStrip`, `ComparisonTable`, `WoWIndicator`, `ChangeTimeline`, `SignalTag`, `ComplaintHeatMap`, `SentimentTrendChart`, `MetricCard`, `OutcomeTable` — follow the same conventions; add entries here as built, before first use.)*

---

## Onboarding components (`components/onboarding/*`)

Light theme **except** the scanning screen (Screen 2), which is the only dark screen
(`bg #141416` — explicit exception, `ui-constraints.md` §12/§15). Scanning components
render light-on-dark (white/white-tinted text), cobalt is the progress/own-brand accent.

### `OnboardingWizard` — `components/onboarding/OnboardingWizard.tsx`
- **Props:** none (self-contained client wizard). Holds the 5-step state; submits via the `completeOnboarding` server action; auto-detects via the `detectBrand` server action; redirects to `/onboarding/scanning`.
- **Composes:** `StepIndicator`, `TextInput`, `AutoDetectInput`, `MultiSelectChips`, `CompetitorList`, `PrimaryButton`.
- **Tokens:** card surface, divider, sh1, cobalt CTA, ink/ink-secondary. **Screen:** Onboarding(1).

### `StepIndicator` — `components/onboarding/StepIndicator.tsx`
- **Props:** `{ steps: readonly string[], current: number }` — numbered step pills; active = cobalt fill, complete = cobalt tint + ✓. **Screen:** Onboarding(1).

### `TextInput` — `components/onboarding/TextInput.tsx`
- **Props:** `InputHTMLAttributes & { label: string, hint?: string }` — labelled field; divider border, cobalt focus, `ink-faint` placeholder/hint. **Screen:** Onboarding(1).

### `AutoDetectInput` — `components/onboarding/AutoDetectInput.tsx`
- **Props:** `{ label?, value, onChange, onDetect:(v)=>Promise<void>, detecting?, buttonLabel? }` (+ input attrs) — domain field that fires `onDetect` on blur and via an inline "Detect Brand" button (cobalt outline). Used for brand domain (auto-fill name) and competitor domains (name+tier). **Screen:** Onboarding(1).

### `MultiSelectChips` — `components/onboarding/MultiSelectChips.tsx`
- **Props:** `{ options: {value,label}[], selected: string[], onToggle:(v)=>void }` — market pill chips; selected = solid cobalt fill, unselected = `base-secondary`. **Screen:** Onboarding(1, Step 2).

### `CompetitorList` — `components/onboarding/CompetitorList.tsx`
- **Props:** `{ competitors: CompetitorEntry[], onChange, onRemove, onAdd, onDetect }` where `CompetitorEntry = { id, domain, name, tier, detecting }`. Removable rows; each row = `AutoDetectInput` (domain) + editable name + editable tier `<select>`. Caps at `COMPETITOR_MAX` (10); seeds `COMPETITOR_DEFAULT_COUNT` (5). **Screen:** Onboarding(1, Step 4).

### `PrimaryButton` — `components/onboarding/PrimaryButton.tsx`
- **Props:** `ButtonHTMLAttributes & { variant?: 'primary'|'ghost' }` — cobalt CTA (primary) / neutral text (ghost, used for "Back"). **Screen:** Onboarding(1, 2).

### `StatusPoller` — `components/onboarding/StatusPoller.tsx`
- **Props:** `{ brandId: string, initialStatus, initialProgress? }` — client component; polls `scan_jobs` every 5s via the **browser** client (RLS-scoped by brand). `completed` → redirect `/dashboard`; `failed` → Retry. Drives `RadarAnimation` + `ProgressChecklist` + `ProgressBar`. **Screen:** Onboarding Scanning(2). **Dark.**

### `RadarAnimation` — `components/onboarding/RadarAnimation.tsx`
- **Props:** none — CSS cobalt radar sweep (`animate-radar-sweep`/`animate-radar-pulse` keyframes in `globals.css`) over concentric rings + pulsing own-brand cobalt dot. **Screen:** Onboarding Scanning(2). **Dark.**

### `ProgressChecklist` — `components/onboarding/ProgressChecklist.tsx`
- **Props:** `{ items: { label, state: 'pending'|'active'|'done' }[] }` — sequential checklist; revealed items show active/done, cobalt marker. Presentational (parent reveals ~800ms). **Screen:** Onboarding Scanning(2). **Dark.**

### `ProgressBar` — `components/onboarding/ProgressBar.tsx`
- **Props:** `{ percent: number }` — cobalt fill on `white/10` track + mono `%`. **Screen:** Onboarding Scanning(2). **Dark.**

---

## Mobile

### `BottomNav` — `components/mobile/BottomNav.tsx`
- **Props:** `{ active: 'dashboard'|'actions'|'intelligence'|'chat'|'admin' }` — fixed 5-item bar; active = cobalt icon+label; ≥44px targets. Screens: Mobile Dashboard(30), Mobile Action Plan(31).

### `MobileActionCard` — `components/mobile/MobileActionCard.tsx`
- **Props:** same as `ActionCard` but Accept/Dismiss 50/50 large buttons, confidence **dots**. Screens: 30, 31.

### `QuickStatsGrid` / `MobileGauge` — `components/mobile/*`
- `QuickStatsGrid { stats: {label,value,wow}[] }` 2×2; `MobileGauge` simplified horizontal threat gauge. Screen: Mobile Dashboard(30).

---

## Hard rules
- No hardcoded colours/fonts — import tokens from the design system per `ui-constraints.md`.
- `AssetGenerationResult` is **always inline**, never a modal.
- Own-brand marker is **always cobalt**; status colours never decorative.
- If a screen needs a component not listed here → add it to this file (path + props + tokens + screens) **before** building it.

---

## Sprint 5 reconciliation — canonical props (supersede the sketches above)
Built in Sprint 5; canonical prop types live in `types/view-models.ts`.
- `ScatterMap` → `{ brand: ScatterPoint; competitors: ScatterPoint[]; onCompetitorClick?(id) }`.
- `CompetitiveRadar` → `{ data: RadarData }` (series are `(number|null)[]`; a **null axis renders muted "PHASE 2", never plotted as 0**).
- `SOVDonut` → `{ slices: SovSlice[] }` (own slice `isOwnBrand` = cobalt; centre % from own slice).
- `ThreatGauge` → `{ data: ThreatGaugeData }` (custom SVG arc; bands 0–40/40–60/60–100).
- `GenerateAssetButton` → `{ recommendationId: string; onGenerate?() }` (the `/api/assets/generate` wiring is a later sprint).
- `AssetGenerationResult` → `{ loading?: boolean; asset?: { type; title; sections:{label,body}[]; channels?; budget? } }` (inline, never a modal).
- `StatusControls` (new) → `components/action/StatusControls.tsx` `{ status; onAccept; onSnooze; onDismiss }`.
- Chart components carry small inline `TOKEN` hex maps (Recharts/SVG fills can't read Tailwind classes) mirroring `tailwind.config.ts`; SOV donut uses a neutral grey ramp (`#8A8A96/#B4B4BE/#CBCBD2`) beyond the 2 palette greys for >2 competitor slices.
