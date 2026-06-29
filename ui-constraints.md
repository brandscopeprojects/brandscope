# Brandscope — UI Constraints & Design System

**Status:** Single source of truth for all UI decisions.
**Derived from:** `brandscopeuibrief.md` (the rulebook) + 30 screen designs (the visual reference).
**Rule of precedence:** UI Brief > observed screens > this file's inferences. The PRD remains the product source of truth; this file governs *look & behaviour* only.

**Legend for every rule below:**
- `[BRIEF]` — stated explicitly in the UI design brief. Non-negotiable.
- `[SCREEN]` — observed in the 30 screen designs (not in the brief, but visually established).
- `[INFER]` — a reasonable default I filled in. Treat as provisional until confirmed.
- `[DECIDE]` — an inconsistency or gap that needs a human decision (see §15).

---

## 1. Foundational Principle

`[BRIEF]` Brandscope is **not a dashboard — it's a decision-making surface.** Every screen must answer one of two questions:
1. **Where do we stand vs the market right now?** (visual / positioning)
2. **What exactly should we do about it this week?** (action / verbal)

If a screen does neither, cut it or merge it. Build every component to serve one of these two registers.

---

## 2. Colour System

`[BRIEF]` **Governing rule: every colour must mean something. No colour is ever used for decoration.** A colour is only allowed if it (a) maps to a status — urgent/watch/opportunity/info — or (b) is the single cobalt brand-marker colour. If more than 3–4 colours are visible at once (excluding status tags), something is wrong.

### 2.1 Surfaces & text

| Token | Hex | Exact use |
|---|---|---|
| Background (base) | `#F5F3EE` | App canvas. Warm off-white — **never** stark `#FFFFFF` for the base. `[BRIEF]` |
| Background (secondary) | `#EDEAE2` | Subtle section separation, inset panels, table header zones. `[BRIEF]` |
| Card surface | `#FFFFFF` | Pure white cards resting above the warm base. `[BRIEF]` |
| Primary text | `#141416` | Near-black. Headlines, body, primary numbers. Never pure `#000`. `[BRIEF]` |
| Secondary text | `#6B6B78` | Muted grey. Metadata, labels, supporting copy. `[BRIEF]` |
| Faint text | `#9999A8` | Timestamps, placeholders, disabled, axis labels. `[BRIEF]` |
| Divider / rule | `#E8E6E0` | Hairline borders only — used sparingly, after whitespace/shadow. `[BRIEF]` |

### 2.2 The single brand accent

| Token | Hex | Exact use |
|---|---|---|
| Brand accent (cobalt) | `#2B5CE6` | **ONLY** for: the user's own brand marker/dot/polygon, primary CTAs, and links. `[BRIEF]` |

`[BRIEF]` Cobalt is **never decorative**. It is the visual signal for "this is *you*" or "this is the primary action." Do not use it for headers, icons-for-flavour, borders, or chart fills that aren't the user's own brand.

### 2.3 Status colours (meaning-bearing)

| Token | Hex | Exact use |
|---|---|---|
| Urgent (signal red) | `#E84545` | `URGENT` urgency tag; LOW confidence; negative results; critical/failed health. `[BRIEF]` |
| Watch (amber) | `#E8952A` | `WATCH` urgency tag; MEDIUM confidence; warning/degraded health; assumption callouts. `[BRIEF]` |
| Opportunity (green) | `#27A96C` | `OPPORTUNITY` urgency tag; positive signals; HIGH confidence; healthy/passed status. `[BRIEF]` |
| Info (cobalt) | `#2B5CE6` | `INFO` urgency tag (reuses the brand cobalt). `[BRIEF]` |

`[INFER]` Status colours are used at **full saturation** for text/icon/needle, and at **low opacity (~8–14% tint)** for filled backgrounds of chips/tags/pills. Confirm exact tint % against the prototype.

---

## 3. Typography

`[BRIEF]` Three typefaces, three distinct jobs. **Never blend their purposes.**

| Typeface | Weights | Used for | Never used for |
|---|---|---|---|
| **Syne** | 600 / 700 / 800 | Large numbers, headline metrics (traffic %, SOV %, threat score, MRR, AI Visibility Score), the wordmark | Body copy, labels, evidence values |
| **Inter** | 300–600 | All UI text, body copy, labels, buttons, table cells, nav items | Big hero metrics, raw evidence values |
| **JetBrains Mono** | (regular/medium) | Timestamps, source URLs, data values pulled from a source, confidence scores, hashes, IDs | Headlines, prose, buttons |

`[BRIEF]` Decision test when choosing a face:
- **A number that *matters*** (a headline metric) → **Syne**.
- **Anything that looks like a fact pulled from a source** (URL, timestamp, scraped value, score) → **JetBrains Mono** — it signals "evidence, not opinion."
- **Everything else** → **Inter**.

`[INFER]` Type scale (provisional, confirm against prototype):
- Hero metric (Syne 700/800): ~40–56px
- Section metric (Syne 600/700): ~24–32px
- Page title (Inter 600): ~20–24px
- Card headline (Inter 600): ~15–16px
- Body (Inter 400): ~14px
- Label/metadata (Inter 400/500): ~12–13px
- Mono evidence (JetBrains Mono): ~12–13px

---

## 4. Elevation, Radius & Spacing

### 4.1 Shadows `[BRIEF]`
Keep elevation extremely subtle — cards **rest** on the warm base, they do not float.

```
sh1 (default card):  0 1px 3px rgba(20,20,22,0.06), 0 1px 2px rgba(20,20,22,0.04)
sh2 (hover/active):  0 4px 16px rgba(20,20,22,0.08), 0 2px 6px rgba(20,20,22,0.04)
sh3 (modals/popups): 0 12px 40px rgba(20,20,22,0.10), 0 4px 12px rgba(20,20,22,0.05)
```

### 4.2 Border radius `[BRIEF]`
- Cards: **8–12px**
- Chips / tags: **6–8px**
- Pills (filter chips) and avatars: **fully rounded**

### 4.3 Spacing `[INFER]` (8px base scale — confirm against prototype)
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48`. Default card padding ~20–24px; gap between cards ~16–20px; section gaps ~24–32px.

`[BRIEF]` **Separate sections with whitespace and subtle shadow before reaching for a hairline border.** Avoid borders/dividers everywhere.

---

## 5. The Split-Field Layout (signature pattern)

`[BRIEF]` The signature layout is **split-field** — not stacked cards, not sidebar + content grid.

```
┌─────────────────────┬─────────────────────┐
│  VISUAL POSITIONING  │     ACTION FEED      │
│  (left / top)        │   (right / bottom)   │
│  Charts, maps,       │   Ranked cards,      │
│  gauges. Almost      │   evidence, text,    │
│  no text.            │   generate buttons.  │
└─────────────────────┴─────────────────────┘
```

Rules:
- The two halves sit at **equal visual weight**. `[BRIEF]`
- Left/top = **calm, spatial**, almost no text (the positioning register). Right/bottom = **dense, actionable** (the verbal register). The tension between them *is* the product. `[BRIEF]`
- **Mobile:** stacks vertically — **visual summary first, action feed below.** `[BRIEF][SCREEN]` (mobile dashboard #24, mobile action plan #28)

---

## 6. Signature Visual Components (the positioning half)

### 6.1 Market Position Map `[BRIEF]` — the single most important visual; anchors the main dashboard
- Scatter plot. **X = market reach, Y = competitive aggression.**
- Every competitor = a labelled dot, sized & coloured by brand.
- **User's own brand = larger, gently pulsing cobalt circle** — impossible to miss, feels alive (subtle pulse, never distracting).
- Quadrants labelled faintly in background: **Dominants / Challengers / Established / Niche.**
- Hover any dot → small tooltip: **traffic, share of voice, threat level.**
- Goal: 3-second read of entire competitive position, no legend needed. `[SCREEN]` seen on Market Intel #6, Brand Profile preview #14, mobile.

### 6.2 Competitive Radar `[BRIEF]`
- 5–6 axis radar. User's brand polygon = **cobalt, filled**. Market average = **faint red outline**. Where cobalt falls short of the red outline = a gap.

### 6.3 Share of Voice Donut `[BRIEF]`
- Single glanceable ring. User's slice **always cobalt**. Biggest number in the centre (Syne).

### 6.4 Threat Gauge `[BRIEF][SCREEN]`
- Needle gauge, **green → amber → red** arc, shows overall weekly competitive threat.
- **2–3 one-line reasons listed beneath it** — visible, not buried in a tooltip.
- `[SCREEN]` rendered as `NN/100` + label ("High Threat") on #7 (84/100), #24 (72/100).

---

## 7. Action Card Anatomy (the verbal half) `[BRIEF]`

Every action card follows this **exact** structure, top to bottom. Do not deviate per-card — consistency lets a user scan five cards in ten seconds.

```
┌───────────────────────────────────────────┐
│ [URGENCY TAG] [CATEGORY TAG]   [CONF ●●●] │  ← status row
│                                            │
│ Headline — the specific recommendation     │  ← bold, 1 sentence,
│                                            │     specific & time-bound
│ One-line "why now" — the trigger, plain    │  ← muted secondary text,
│ language                                   │     references evidence
│                                            │
│ ⚠ Assumption callout (LOW/MED conf only)   │  ← amber inline chip,
│                                            │     above evidence toggle
│ [🔍 Evidence — source · date · confidence] │  ← collapsed by default
│ ─────────────────────────────────────────  │
├───────────────────────────────────────────┤
│ [✦ Generate asset]        [Mark done]      │  ← footer actions
└───────────────────────────────────────────┘
```

Element order (never reorder):
1. **Status row:** urgency tag (top-left, always) + category tag + confidence indicator (right).
2. **Headline:** Inter 600, one sentence, specific and time-bound.
3. **"Why now":** muted secondary text, plain-language trigger, references the evidence.
4. **Assumption callout:** amber inline warning chip — **only on LOW/MED confidence** — flags what is inferred vs directly evidenced. Never hide this distinction. `[BRIEF]`
5. **Evidence drawer:** collapsed by default (see §9).
6. **Footer actions:** `✦ Generate asset` (primary, cobalt) + `Mark done` / `Dismiss`. `[SCREEN]` mobile uses `Accept` / `Dismiss`.

---

## 8. Tag & Indicator Systems

### 8.1 Urgency tags `[BRIEF]` — exactly FOUR, do not invent more
| Tag | Colour | Meaning |
|---|---|---|
| `URGENT` | red `#E84545` (bg/text tint) | Act now |
| `WATCH` | amber `#E8952A` | Monitor / medium |
| `OPPORTUNITY` | green `#27A96C` | Positive opening |
| `INFO` | cobalt `#2B5CE6` | Informational |

Always top-left of the card. `[SCREEN]` Category tags (e.g. `Promotions`, `Traffic & SEO`, `GEO / AEO`) sit next to the urgency tag and are **neutral-styled** (grey), not status-coloured.

### 8.2 Confidence indicator `[BRIEF]`
- **Three small filled/unfilled bars + a label: HIGH / MED / LOW.**
- Colour-matched: HIGH = green, MED = amber, LOW = red.
- **Must be visually distinct from the urgency tag** — they answer different questions ("how urgent" vs "how sure are we").
- `[DECIDE]` Screens render confidence as **three dots `●●●`** (e.g. #29 "●●● High", #7, #11) rather than bars. Bars (brief) vs dots (screens) must be reconciled — see §15.

### 8.3 Confidence tiers (from PRD, for data layer)
HIGH ≥ 0.80 · MEDIUM 0.50–0.79 · LOW < 0.50 · REJECT < 0.30 (REJECT not surfaced to brand UI).

---

## 9. Evidence Drawer `[BRIEF]` — first-class, never a debug panel

Collapsed by default as `[🔍 Evidence — source · date · confidence]`. When expanded, show **in this exact order**:
1. **Source URL** — a real, styled link (cobalt), value in JetBrains Mono.
2. **Exact timestamp** of when it was scraped — JetBrains Mono.
3. **Verbatim extracted text** — in a **quote-styled block**.
4. **Before/after change** detected — only if applicable, explicit.

`[BRIEF]` Design it with the same care as primary content — this is what makes the product defensible. Maps to the PRD evidence chain (URL + scrape timestamp + verbatim text + before/after + SHA-256 + "view source").

---

## 10. Generated Asset Output `[BRIEF][SCREEN]`

- On `Generate asset`, result renders **inline, directly below that card** — **never a modal** that disconnects it from its evidence.
- Header bar identifies asset type (e.g. `CAMPAIGN BRIEF`) + actions: **Copy**, **Send-to-team** (#29 also: Edit, Save to Library, Share).
- Lightweight loading state: small spinner + "Writing your campaign brief…" — never a blank wait.
- `[SCREEN]` #29 asset body structure: Campaign Objective → Target Audience → Key Message → Headline Options → Body Copy → CTA Options → Recommended Channels (Meta Ads / Google Ads / WhatsApp chips) → Budget Recommendation. Tagged "New" with generated timestamp (mono).

---

## 11. Filtering & Navigation Patterns

### 11.1 Filter-chip row `[BRIEF][SCREEN]`
- Horizontal row above the action feed: `All · Urgent · Watch · Opportunity`, **each with a live count**.
- Pill-shaped, colour-tinted to its status colour at low opacity, **filled solid when active**.
- `[SCREEN]` #28: `All 56 · Urgent 12 · Watch 16 · Opportunity 16`.

### 11.2 Brand-facing sidebar — order `[SCREEN]` (full product; MVP shows a subset)
1. Dashboard
2. Market Intel
3. Promotions
4. Traffic & SEO
5. Social & Ads
6. Ads & Spend
7. Products
8. Customers
9. Regulatory
10. Hiring & Signals
11. GEO / AEO / SEO
12. Action Plan
13. Assets Library
14. Performance
15. Reports
16. Brand Chat
— divider —
**Admin group:** Settings · Help (Brand Admin pages — Configuration, Competitors, Team, Alerts, Scan Config, Billing — reached via tabs within the admin area `[SCREEN]` #14, #16, #17, #27).

Wordmark + Brandscope logo top of sidebar. Brand/market context switcher in header (e.g. "RiversBet · Nigeria ▾") `[SCREEN]`.

### 11.3 Internal admin sidebar — order `[SCREEN]` (distinct, more data-dense surface)
1. Dashboard
2. System Health
3. Agent Control
4. API Management
5. Security Centre
6. Feature Health
7. Monitoring Centre
8. Client Management
9. Knowledge Base
10. Revenue Dashboard
11. Internal Chat
— divider — Settings · Help

`[BRIEF]` Internal admin is a **separate visual language** — borrows these tokens but is more technical/data-dense, less split-field, table-heavy. Gets its own brief.

### 11.4 Page-level tabs `[SCREEN]`
Competitor Profile (#7): Overview · Promotions · Digital · Intelligence. Brand Admin (#14): Brand Profile · Competitors · Team · Alerts · Scan Config · Billing.

---

## 12. Recurring Component Patterns Observed Across 30 Screens `[SCREEN]`

- **Metric stat card:** big Syne number + small Inter label + trend delta (`↑ 12%` green / `↓` red). Used in Quick Stats, KPI rows (#13, #24, #30).
- **Status pill:** `Healthy`/`Good`/`Passed` (green), `Degraded`/`Warning`/`Partial` (amber), `Critical`/`Failed`/`Blocked` (red). Used in Monitoring (#15), Security sessions (#26), Feature Health, API Health (#21).
- **Tier badge (competitor):** `DOMINANT`, `CHALLENGER`, `MID-MARKET` (#6, #7, #16). `[DECIDE]` DOMINANT renders green — conflicts with "green = opportunity/positive only" (see §15).
- **Threat score block:** `NN/100` + label, red when high (#7 84/100, #24 72/100).
- **Result tag (outcomes):** `POSITIVE` (green) / `NEUTRAL` (grey/amber) / `NEGATIVE` (red) — Performance log #13.
- **Data table:** Inter cells, secondary-text headers on `#EDEAE2` zone, mono for numeric/evidence values, status pills inline. Used heavily in admin (#16, #21, #22, #26, #30) and intelligence pages.
- **Comparison matrix / heatmap:** Active/Growing/Declining/Absent cells with status-tinted backgrounds (Product Activity Matrix #11; Social engagement #8; Complaint Theme #10).
- **Activity / change timeline:** dated rows with category tag + impact label (Competitor Profile recent changes #7; Hiring timeline #12).
- **Evidence/source link:** mono URL + page number, "View Source PDF" (#9 violation alerts, #22 knowledge base).
- **"What this means for you" strip:** 2–3 mini action cards with urgency tag + Generate button (#7).
- **Chips for channels/markets/tags:** removable pill chips (markets in Brand Profile #14; channels in asset #29).
- **Donut / bar / line / scatter / radar / gauge** charts — restrained palette, cobalt = own brand, status colours only where meaningful.
- **Sentiment/trend multiline charts:** one line per competitor; own brand cobalt, others muted (#10 sentiment).
- **Toggle switches:** cobalt when on (Alerts #17, Intelligence Preferences #14, Scheduled Reports #23).
- **Empty/loading states:** spinner + plain-language line (per §10).
- **Onboarding scan screen (#25):** dark radar-sweep animation, step "5 of 5", live checklist ("Identified 7 competitors…"), progress %, "First scan takes 2–3 minutes." `[DECIDE]` This is **dark-themed** — an explicit exception to the light theme (see §15).

---

## 13. Tone of Voice in UI Copy `[BRIEF]`
- Headlines **specific and time-bound**: *"Your welcome bonus is ₦50k below the new market standard — act before this weekend's fixtures,"* never *"Bonus gap detected."*
- **Never hide uncertainty** — if inferred, say so in words, not just a confidence score.
- **No exclamation points, no hype.** Credibility comes from precision, not enthusiasm.

---

## 14. What "Light Theme" Must NOT Become `[BRIEF]`
- **Not** a plain white-and-grey SaaS template — the warm base `#F5F3EE` + single cobalt accent are the safeguard.
- **Not** cluttered with colour — >3–4 colours at once (excluding status tags) = wrong.
- **Not** border-heavy — whitespace + subtle shadow before hairlines.
- **Not** a serif/cream "editorial blog" look — keep it technical-feeling under the warmth (Syne + Inter + Mono is the texture).
- **Cobalt is never decorative.** Status colours are never decorative.

---

## 15. Inconsistencies & Open Decisions `[DECIDE]`

These need a ruling before/while building. Until decided, I will follow the **brief** and flag the spot in code.

1. **Confidence: bars vs dots.** Brief specifies *three filled/unfilled bars + HIGH/MED/LOW label*. Screens render *three dots `●●●`*. → Pick one canonical component. (Recommend: bars per brief, or formally adopt dots and update the brief.)
2. **DOMINANT tier badge is green.** Green is reserved for opportunity/positive only (§2.3, §14). A competitor being "dominant" is a *threat*, not a positive — green is semantically wrong here. → Decide a neutral/dark badge palette for tiers (e.g. grey scale, or dark = dominant) that doesn't collide with status meaning.
3. **Onboarding scan screen is dark-themed** (#25) while the product is light. → Confirm onboarding is an intentional dark "moment" (the brief says onboarding gets its own separate brief), so this is likely allowed — but record it explicitly so it isn't treated as the app theme.
4. **Billing screen (#27) sidebar mixes brand + internal-admin items.** Billing is a Brand Admin feature, yet the screen shows internal-admin nav entries (System Health, Agent Control, etc.). → Confirm correct nav for the billing/brand-admin context (likely a screen-mock artifact).
5. **Category tag taxonomy not fixed.** Urgency tags are exactly 4; category tags (`Promotions`, `Traffic & SEO`, `Tech Stack`, `Hiring`, `GEO / AEO`, etc.) appear ad hoc. → Define the closed set of category tags + their (neutral) styling.
6. **Nav label vs page-title naming.** Sidebar "GEO / AEO / SEO" vs page "GEO Intelligence"; "Ads & Spend" vs "Ad Network & Spend Intelligence"; "Social & Ads" vs "Social Intelligence". → Lock canonical names to avoid drift.
7. **Status-tint opacity %** for chip/pill backgrounds is not specified. → Confirm exact tint against the HTML prototype (§10 brief reference artifact).
8. **Exact type scale & spacing scale** are inferred (§3.1, §4.3). → Confirm against the prototype.
9. **Asset footer actions vary** — desktop `Generate asset / Mark done`, mobile `Accept / Dismiss`, asset result `Copy / Edit / Save to Library / Share`. → Confirm the canonical action set per surface.
10. **"Reference HTML prototype" (brief §10)** is the behavioural spec for hover/expand/filter. → Request it before building the dashboard.

---

## 16. How To Use This File
- Consult this file **first** whenever a UI decision is uncertain.
- If a rule here conflicts with a new instruction, the **brief wins**; update this file and note the change.
- When a `[DECIDE]` item is resolved, move it into the relevant section and mark it resolved with the date.
- Never introduce a colour, font, or pattern not represented here without adding it here first.
