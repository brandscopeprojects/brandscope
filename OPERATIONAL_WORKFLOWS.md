# Brandscope — Operational Workflows (Frontend + Backoffice)

**Version:** 2.0  
**Last Updated:** 2026-08-20  
**Audience:** Brand owners, team leads, Brandscope operators

---

## Table of Contents

1. [Brand Owner Workflow](#1-brand-owner-workflow)
2. [Admin/Operator Workflow](#2-adminoperator-workflow)
3. [Weekly Campaign Execution](#3-weekly-campaign-execution)
4. [Incident & Troubleshooting](#4-incident--troubleshooting)
5. [Decision Trees](#5-decision-trees)

---

## 1. Brand Owner Workflow

### 1.1 Initial Setup (First Time)

**Goal:** Get from zero to first intelligence report (takes ~20 min)

#### Step 1: Sign In
```
User lands on /login
  ├─ Email + password (or demo login)
  └─ Redirected to /onboarding (if no brand yet)
```

**Screen:** Login page (Brandscope logo, email/password inputs, "Sign in" button)

---

#### Step 2: Onboarding Step 1 — Enter Your Brand

**Screen:** "Tell us about your brand"

| Field | Required | Example |
|---|---|---|
| **Brand Name** | ✅ | "Jantabets" |
| **Website Domain** | ✅ | "jantabets.com" |
| **Market(s)** | ✅ | Nigeria, Kenya, South Africa (multi-select) |
| **Industry Vertical** | ✅ | "iGaming / Betting" |
| **Tier** | ✅ | Tier 1 (Large), Tier 2 (Mid), Tier 3 (Emerging) |

**Actions:**
- Click "Next" → Step 2 (brand created in DB, user redirected)

**Under the hood:**
- `brands` row inserted with user's organisation_id
- Self-competitor row created (keyed by domain, hidden from user)
- `brand_preferences` row created with defaults (all modules enabled)

---

#### Step 3: Onboarding Step 2 — Add Competitors

**Screen:** "Who are your main competitors?"

```
Competitor List (drag-to-reorder by priority)

1. [Competitor 1]  [Remove]
2. [Competitor 2]  [Remove]
3. [Competitor 3]  [Remove]
4. [Competitor 4]  [Remove]
5. [Competitor 5]  [Remove]

[+ Add Competitor]

Instructions:
- Enter domain (e.g., betking.com)
- System auto-discovers: Name, Tier, Industry
- Drag to set priority (top = most important)
- Max 10 competitors
```

**Interaction:**
1. User clicks "+ Add Competitor"
2. Modal opens: "Enter competitor domain"
3. User types domain → System resolves via Whois/DNS (auto-fill Name, Industry)
4. Click "Add" → Row added to list
5. User drags rows to reorder (priority)
6. Click "Next" → Step 3

**Under the hood:**
- `competitors` rows inserted/updated (keyed by domain)
- `brand_competitors` rows created with priority order
- Geography + industry auto-discovered from Whois

---

#### Step 4: Onboarding Step 3 — Configure Modules

**Screen:** "Choose which sections to monitor"

```
Module Toggles (each with icon + description):

✅ Traffic & SEO                — Ranking, traffic, domain authority
✅ Tech Stack                   — Technologies, platforms used
✅ Promotions & Bonuses         — Active campaigns, offers
✅ Hiring & Growth Signals      — Job postings, expansion signals
✅ Customers & Brand Sentiment  — Reviews, mentions, perception
✅ Regulatory Compliance        — Legal/compliance risks
✅ Social & Ads                 — Ad spend, social presence
✅ Market Intelligence          — AI visibility, trending topics

Disabled modules skip data fetch (saves cost + time)
Recommendation: Enable all for first scan to get full picture
```

**Action:** Click "Next" → Summary screen

---

#### Step 5: Onboarding Step 4 — Review & Confirm

**Screen:** "Ready to scan?"

```
Brand Summary:
  Name: Jantabets
  Domain: jantabets.com
  Markets: Nigeria, Kenya, South Africa
  Tier: Tier 2 (Mid-market)
  
Competitors (5):
  1. BetKing (Priority 1)
  2. SportyBet (Priority 2)
  3. 1xBet (Priority 3)
  4. Bet9ja (Priority 4)
  5. Nairabet (Priority 5)

Modules Enabled (7/8):
  ✅ Traffic & SEO
  ✅ Tech Stack
  ... (7 total)

Estimated Time: 2–3 minutes
Estimated Cost: $10–$15 (one-time setup)

[Cancel] [Start First Scan]
```

**Action:** Click "Start First Scan" → Redirected to /dashboard with scan in progress

---

### 1.2 Weekly Scan & Intelligence Review

**Goal:** Review automated competitive intelligence + execute actions

**Frequency:** Every Monday automatically (or manual "Scan now" anytime)

---

#### Phase 1: Scan in Progress (2–3 minutes)

**Screen:** /dashboard → ModuleStreamingView

```
Module Intelligence (Real-time)

Intelligence streams in real-time as researchers complete:

[ 🔄 Loading... ] Traffic & SEO            (Checking rankings...)
[ 🔄 Loading... ] Tech Stack               (Scanning tech stack...)
[ ✅ Complete  ] Promotions                (Found 2 active campaigns)
[ 🔄 Loading... ] Customers                (Gathering reviews...)
[ 🔄 Loading... ] Regulatory               (Checking compliance...)
[ 🔄 Loading... ] Hiring & Signals         (Found 3 open roles)
[ 🔄 Loading... ] Social & Ads             (Tracking ad spend...)
[ 🔄 Loading... ] Market Intelligence      (AI analysis...)

Progress: 1/8 modules (12%)
Estimated time remaining: 2 min

[✓] This scan automatically runs every Monday at 6 AM UTC
[✓] Raw data updates live below
[?] Why is this taking long? → Scan troubleshooting guide
```

**What's happening:**
- 8 fetchers running in parallel (each ~60s max)
- Cache tables being written as each fetcher completes
- Realtime subscriptions pushing updates to browser
- UI shows "Loading..." until cache row written
- Progress bar shows (completed_steps / expected_modules)

**User experience:**
- User can navigate away (dashboard auto-refreshes)
- Or watch live (satisfying to see sections fill in)
- No "manual action" needed during scan

---

#### Phase 2: Scan Complete (Dashboard shows results)

**Screen:** /dashboard → DashboardView (once status = "completed")

```
HEADER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Jantabets — Week of Aug 18, 2026
AI Visibility Score: 68 / 100 (+3 WoW) ↗
Action Items: 7 recommendations (3 urgent)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEFT SIDE (55%)                 RIGHT SIDE (45%)
═══════════════════════════════════════════════

Positioning Visuals            Action Feed

[Scatter Plot]                 📌 Urgent (3)
Rank vs Traffic                  ├─ "Competitors up-ranking..."
by Competitor                    ├─ "New promo campaign..."
                                └─ "Tech stack shift..."
                              
[Radar Chart]                  ℹ️ Standard (4)
Module Coverage                  ├─ "Market trend..."
by Section                       ├─ "Regulatory update..."
                                └─ ...

[SOV / Share of Voice]
Visibility Gap
vs Competition

[Threat Matrix]
Who's gaining?
Risk heatmap
```

**User can:**
1. Click on any recommendation → See evidence + source URL
2. Click "View details" on a section → Full metrics for that module
3. Click recommendation → "Generate Assets" → Pre-written copy + creative specs
4. Click "Create Action Plan" → Opens action_plans view for this scan
5. Click "Brand Chat" → Ask questions about the data

---

### 1.3 Weekly Workflow: The 5 Steps

#### Step 1: Review Dashboard (5 min)
1. User lands on /dashboard (Monday morning)
2. Scans the 7 recommendations (ranked by priority)
3. Notes 3–4 key threats or opportunities

**Decision point:**
```
Is there an urgent action?
  ├─ Yes → Go to Step 2
  └─ No  → Check back in 2 days or next Monday
```

---

#### Step 2: Drill into Module Details (10 min)

**Example: "Competitors are up-ranking for betting bonus keywords"**

User clicks recommendation → Sees:

```
Traffic & SEO — Detailed View

Week of Aug 18, 2026

Competitor Rankings (Top 10 Keywords)
┌────────────────┬──────────┬─────────┬───────┬─────────────┐
│ Keyword        │ BetKing  │ SportyB │ Jant. │ WoW Trend   │
├────────────────┼──────────┼─────────┼───────┼─────────────┤
│ free bet bonus │ Rank 2   │ Rank 4  │ Rank 8│ ↑↑ (was 12) │
│ sports betting │ Rank 1   │ Rank 3  │ Rank 7│ ↑ (was 8)   │
│ welcome bonus  │ Rank 3   │ Rank 2  │ Rank 9│ ↓ (was 7)   │
└────────────────┴──────────┴─────────┴───────┴─────────────┘

Estimated Monthly Traffic (from Data ForSEO)
- BetKing: 45K searches/mo for top 100 keywords
- SportyBet: 32K searches/mo
- Jantabets: 28K searches/mo (down 5% WoW)

Action Recommendation:
"BetKing gaining share. Launch paid search for 'welcome bonus'
to recapture 15% of gap. Est. cost: $2K/mo."

Evidence Source: data.dataforseo.com
Last Updated: Aug 18, 2026 06:15 UTC
```

User can:
- Click "Show all keywords" → Full spreadsheet
- Click "Export to CSV" → Download for team
- Click "Track this keyword" → Set alert (if price > X or rank drops below Y)

---

#### Step 3: Check Other Modules (5 min)

User tabs through:

**Social & Ads**
```
BetKing Ad Spend Analysis
Week of Aug 18, 2026

Total Ad Spend: ~$8,500 (up 12% WoW)
Platforms: Facebook ($4K), Google ($3.5K), TikTok ($1K)
New Ads: 3 creative variations
Top Performing Ad: "Free Bets Daily 🎁" (45% CTR)

Your Ad Spend: ~$3,200
Gap to leader: BetKing spending 2.7x more
```

**Tech Stack**
```
BetKing — Technology Stack Changes (Last 7 Days)

New Tools Added:
  ✅ Segment (CDP) — Data collection layer
  ✅ Mixpanel (Analytics) — Advanced tracking

Removed:
  ❌ Google Analytics 360 (migrating to Segment)

Implications:
"BetKing upgrading analytics infrastructure for personalization.
Expect more targeted campaigns in 2–4 weeks."
```

**Hiring & Growth**
```
BetKing Open Roles (Aug 18, 2026)

New postings (last 7 days):
  • Senior Frontend Engineer (2 roles)
  • Data Analyst (Growth)
  • Customer Success Manager

Total open roles: 12 (↑ from 8 last week)
Trend: Expansion phase (hiring for scale)

Your open roles: 3
Action: "Competitors hiring aggressively. Talent risk in 4–8 weeks."
```

**Promotions**
```
BetKing — Active Promotional Campaigns

Campaign: "August Madness" Free Bets
  Duration: Aug 1–31
  Offer: Up to ₦50K free bets
  Landing page: betking.com/august-madness
  Status: Active (20 days remaining)

Your campaigns: 2 active
Gap: 0 (you're matching competitor offer levels)
```

---

#### Step 4: Generate Assets (10 min)

User clicks "Generate Assets" on a recommendation:

**Screen:** Asset Generator Modal

```
Recommendation: "Launch paid search campaign for 'welcome bonus' keywords"

Generated Assets:

[Asset 1: Google Search Ad]
Headline: "Welcome Bonus — Up to ₦50K Free Bets"
Description: "Join Jantabets today. Get ₦50K bonus on first deposit."
Display URL: jantabets.com/welcome
Target Keywords: welcome bonus, free bet bonus, betting signup
Estimated CPM: $1.50
Estimated Reach: 45K/mo

[Copy] [Edit] [Download]

[Asset 2: Landing Page Copy]
Title: "Claim Your ₦50K Welcome Bonus Now"
Body: "Jantabets offers the most generous welcome bonus in Nigeria..."
CTA: "Get Your Bonus Now"
Target Audience: New customer signups

[Copy] [Edit] [Download]

[Asset 3: Social Media Post]
Platform: Facebook
Format: Carousel (4 slides)
Copy: "Your welcome is worth ₦50K 🎁 Join Jantabets..."
Image Specs: 1200x628px, landscape

[Copy] [Edit] [Download]

[Generate All] [Export ZIP]
```

User can:
- Copy text to clipboard
- Download as individual files or ZIP
- Edit generated copy in-line
- Request different variations ("more aggressive", "less legal jargon", etc.)

---

#### Step 5: Create Action Plan (5 min)

User clicks "Create Action Plan" → Opens panel:

```
Week of Aug 18, 2026 — Action Plan

Status: Draft (not yet executing)

Actions (7 total):

[ ] URGENT (3)
  1. Launch paid search — "welcome bonus" keywords
     Estimated cost: $2K/mo
     Deadline: Start by Thursday
     Owner: Marketing Lead
     Status: Assigned to Sarah Chen
     
  2. Respond to regulatory update — New compliance rule
     Action: Review docs + update T&C
     Deadline: By Friday EOD
     Owner: Legal
     Status: Awaiting Legal review
     
  3. Monitor BetKing hiring spree
     Action: Alert if any key talent poached
     Frequency: Daily check
     Owner: HR Lead
     Status: Ongoing

[ ] STANDARD (4)
  4. Test new CDP stack like BetKing
  5. Publish counter-offer blog post
  6. Increase organic social cadence
  7. Check tech stack gaps

[Mark as Complete] [Print] [Share with Team]

This plan auto-expires on Aug 25 (new one generated next Monday)
```

User can:
- Check off completed actions
- Assign actions to team members (sends email notification)
- Change deadline
- Share plan with team (generates shareable link)
- Download as PDF or email

---

### 1.4 Mid-Week Check-In (Optional)

**Day 3–4 of week:** User can optionally:

1. Click "Scan now" to get fresh data (costs $10–$15, but data is a week fresher)
2. Check "Brand Chat" for specific questions:
   - "Which competitor gained the most traffic this week?"
   - "What are the top 3 threats I should act on?"
   - "Compare our tech stack to BetKing"
3. Receive automated alerts (if configured):
   - "Alert: Competitor traffic up 20%"
   - "Alert: New regulatory rule in Nigeria"

---

### 1.5 Admin Settings

**Route:** /admin

User can configure:

```
Brand Settings
  ├─ Module toggles (enable/disable sections)
  │  └─ Saves cost if you disable expensive modules (e.g., Social & Ads)
  ├─ LLM model preference (Claude vs GPT)
  ├─ Scan schedule (weekly, bi-weekly, daily)
  └─ Alert thresholds
     └─ "Alert me if traffic drops > 10% WoW"
     └─ "Alert me if new competitor added"

Competitors
  ├─ [Add/Edit/Remove]
  ├─ Drag to reorder priority
  └─ [View competitor deep-dive]

Alerts
  ├─ Traffic spike: > 20% WoW
  ├─ Regulatory change: [list of rules]
  ├─ Competitor action: New job post, new ad, new tech
  ├─ Recipient: Email list (sarah@brand.com, legal@brand.com)
  └─ Frequency: Daily digest, immediate, weekly

Billing
  ├─ Current spend: $320/mo (4 scans × $80)
  ├─ Daily cap: $50
  ├─ Balance: $2,100 (DataForSEO credit)
  ├─ Payment method: [Update card]
  └─ Invoice history: [Download PDFs]
```

---

## 2. Admin/Operator Workflow

### 2.1 Daily Operations (Brandscope Operations Team)

**Goal:** Monitor system health, manage costs, respond to incidents

#### Morning Briefing (9 AM UTC, 5 min)

**Screen:** Admin dashboard (internal only, `/admin` with `INTERNAL_ADMIN_SECRET`)

```
System Health — Week of Aug 18, 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCAN EXECUTION (Last 24h)

Completed:  12/12 brands ✅
Failed:     0 ❌
Partial:    0 ⚠️
Avg cost:   $12.50 (within budget)
Avg time:   85s (healthy)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODULE HEALTH (Last 24h)

✅ traffic_seo         12/12 healthy
✅ tech_stack          12/12 healthy
⚠️  geo_aeo            11/12 (1 timeout)
❌ customer_intel      10/12 (2 DataForSEO errors)
✅ regulatory          12/12 healthy
✅ promotions          12/12 healthy
✅ hiring_signals      12/12 healthy
⚠️  social_ads         11/12 (1 API key missing)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COST GOVERNANCE

Daily spend (YTD):     $2,450 (budget: $2,500)
Remaining balance:     $50 (OK)
Provider spend:
  - DataForSEO:        $1,800 (72%)
  - LLM (Anthropic):   $400 (16%)
  - Firecrawl:         $150 (6%)
  - Apify:             $100 (4%)

⚠️ WARNING: DataForSEO at 72% of weekly budget
Action: Consider disabling social_ads or reducing competitor cap

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INCIDENTS (Last 24h)

🔴 CRITICAL (0)
🟠 WARNING (1)
  - 1 org: customer_intel module timing out
    Root cause: DataForSEO rate limit hit
    Action: Reduce API concurrency (in progress)
    
🟡 INFO (3)
  - Firecrawl API down for 15min (auto-recovered)
  - 2 researchers cold-started (>5s init time)
  - DetectZeStack webhook delayed (2min SLA miss)

═════════════════════════════════════════════

[Drill into incidents] [View logs] [Page on-call]
```

---

#### Issue: Module Timing Out (Operator Response)

**Scenario:** Customer_intel researcher timeout (took 95s, budget is 90s)

**Troubleshooting steps:**

1. Check logs: `SELECT * FROM feature_health WHERE feature_name='customer_intel' ORDER BY created_at DESC LIMIT 5;`
   ```
   Result:
   - Aug 18 12:00: status=down, root_cause="time budget exceeded before competitor start"
   - Aug 18 06:00: status=healthy
   - Aug 17 18:00: status=healthy
   ```

2. Check DLQ: `SELECT * FROM dead_letter_queue WHERE task_type='researcher-customer' ORDER BY created_at DESC LIMIT 1;`
   ```
   Result:
   - payload: full ScanModuleMessage
   - last_error: "Error: time budget exceeded (80000ms) at processCompetitor"
   ```

3. Root cause analysis:
   - Researcher ran out of budget (80s limit)
   - Likely cause: Apify API slow or DataForSEO backlinks query taking too long
   - Last success was yesterday, so it's intermittent

4. Options:
   ```
   Option A (Quick fix): Reduce TIME_BUDGET_MS in researcher-customer from 80s to 60s
             (skip 1–2 competitors if needed to stay within budget)
   
   Option B (Robust fix): Add concurrency control to prevent too many parallel Apify calls
             (queue them, process 2 at a time instead of 5)
   
   Option C (Monitor): Whitelist customer_intel in kill switch, disable for now
             (reduces cost, users see "coming soon" on that section)
   
   Recommendation: Option A (quick) + Option B (next sprint)
   ```

5. Action taken:
   ```
   Step 1: Update researcher-customer/index.ts
           TIME_BUDGET_MS = 60_000 (was 80_000)
           
   Step 2: Commit + push to claude/ops-hotfix-customer-intel
   
   Step 3: Deploy via Supabase Dashboard
   
   Step 4: Monitor next 12 scans to confirm fix
   
   Step 5: If still timing out, escalate to engineering team
   ```

---

#### Issue: DataForSEO Balance Low

**Scenario:** Balance dropped to $2.50, daily spend is $50/day, floor is $4

**Action:**

```
Check who's spending most:

SELECT
  organisation_id,
  SUM(amount_usd) as total_spend,
  COUNT(*) as operation_count
FROM provider_spend
WHERE provider='dataforseo' AND date >= now()::date - 7
GROUP BY organisation_id
ORDER BY total_spend DESC;

Result:
- Org A (Jantabets): $280 (4 scans × $70)
- Org B (SportBrand): $150 (2 scans × $75)
- Org C (Others):    $60

Decision:
- Org A is the power user
- Call them → "Your DataForSEO balance is low"
- Offer: (a) Top up account, (b) Reduce scan frequency, (c) Disable expensive modules

If they top up: Resume scanning
If they don't: Mark brand as "paused" until they add credit
```

---

### 2.2 Weekly Ops Review (Friday 3 PM UTC, 30 min)

**Attendees:** Ops lead, engineering lead, product lead

**Agenda:**

```
1. Health Summary (5 min)
   ├─ # scans completed (should be 100% for active brands)
   ├─ # failed modules (target: 0)
   ├─ Top 3 incidents this week
   └─ Cost forecast (will we exceed budget?)

2. Cost Governance (10 min)
   ├─ Spend by provider (DataForSEO, LLM, Firecrawl, Apify)
   ├─ Spend by brand (top 3 spenders)
   ├─ Any orgs at risk of hitting cap?
   └─ Recommend: Disable module X for cost reduction?

3. Module Performance (10 min)
   ├─ Average latency per module (target: <90s)
   ├─ Failure rate per module (target: 0%)
   ├─ Any modules consistently slow?
   └─ Recommend: Optimize geo_aeo LLM calls?

4. Incident Review (5 min)
   ├─ What broke? (Firecrawl API, DetectZeStack webhook, etc.)
   ├─ Why? (Timeout, quota, network)
   ├─ How'd we respond?
   └─ Prevention for next time?

5. Next Week Forecast
   ├─ Expected cost (based on # scans + modules enabled)
   ├─ Any planned API deprecations?
   ├─ Any new brands onboarding?
   └─ Capacity: Can we handle growth?

Decisions:
  ├─ [ ] Kill switch customer_intel for next week (cost cutting)
  ├─ [ ] Increase Anthropic daily cap from $100 to $150 (for synthesis)
  ├─ [ ] Schedule Firecrawl API upgrade (Friday 2–3 AM UTC)
  └─ [ ] Alert Jantabets about DataForSEO balance
```

---

### 2.3 Incident Response Playbook

#### Incident: Synthesis Not Generating Plans

**Alert:** "Synthesis failed for Jantabets scan (Aug 18)"

**Timeline:**
```
06:00 UTC: brand-scan completes, expected_modules set to [8]
06:15 UTC: traffic_seo calls completeModule (1/8 done, progress=12%)
06:30 UTC: geo_aeo calls completeModule (2/8 done, progress=25%)
...
07:00 UTC: All 8 modules completed (progress=100%)
07:01 UTC: synthesis-draft-audit invoked
07:05 UTC: synthesis-draft-audit FAILS
           Error: "LLM timeout (Anthropic API took >60s)"
           Result: recommendations table still empty
           scan_jobs.status still = "running" (never set to completed)
07:06 UTC: User reports "dashboard stuck at 'processing'"
```

**Troubleshooting (ops team):**

1. Check scan_jobs status:
   ```sql
   SELECT id, status, synthesis_enqueued, error_message, completed_at
   FROM scan_jobs
   WHERE brand_id = (SELECT id FROM brands WHERE name='Jantabets')
   ORDER BY created_at DESC LIMIT 1;
   
   Result:
   - status: running (not completed)
   - synthesis_enqueued: true
   - error_message: null
   - completed_at: null
   ```

2. Check feature_health:
   ```sql
   SELECT feature_category, status, root_cause
   FROM feature_health
   WHERE scan_job_id = '...' ORDER BY created_at DESC;
   
   Result:
   - synthesis: status=down, root_cause="LLM timeout"
   - all 8 modules: status=healthy
   ```

3. Check DLQ:
   ```sql
   SELECT task_type, failure_reason, last_error
   FROM dead_letter_queue
   WHERE task_type='synthesis-draft-audit' AND created_at > now() - 10 min;
   
   Result:
   - task_type: synthesis-draft-audit
   - failure_reason: "Anthropic Messages API response timeout"
   - last_error: "504 Gateway Timeout after 65s wait"
   ```

4. Root cause: Anthropic API slow (likely overload on their side)

**Resolution options:**

```
Option A (Retry): Invoke synthesis-draft-audit again
  - Click [Retry] button in UI
  - If it succeeds, plan is generated and scan completes

Option B (Manual fix): Manually set status to completed
  - UPDATE scan_jobs SET status='completed' WHERE id='...'
  - Dashboard shows "completed but with warnings"
  - User sees cache data but no recommendations

Option C (Wait): Wait 5 min for Anthropic to recover, then retry
  - Set reminder to check in 5 min

Recommendation: Try Option A first (retry)
```

**User communication (to Jantabets brand owner):**

```
Email:

Subject: Your Jantabets scan — Brief delay (should be ready in 5 min)

Hi there,

Your intelligence scan completed successfully! We're just finalizing
your action plan (usually takes <1 min, but Anthropic API is running
slow this morning).

Your dashboard will auto-update in ~5 min. You can also refresh
manually.

In the meantime, you can view the raw competitor data in the
Intelligence section.

Sorry for the wait!

— Brandscope Team
```

---

## 3. Weekly Campaign Execution

### 3.1 Recommended Campaign Workflow

**Scenario:** Action Plan recommends "Launch paid search for welcome bonus keywords"

#### Step 1: Plan (Day 1, Brand Owner)

```
Action from dashboard:
  Title: "Launch paid search — welcome bonus keywords"
  Recommendation ID: rec_123
  Assets generated: ✅ (4 creatives ready)
  Status: Assigned to Sarah Chen (Marketing Lead)
  Deadline: Thursday EOD
  
Marketing Lead opens Assets:
  - Google Search Ad headline
  - Landing page copy
  - Bid strategy: $1.50 CPM
  - Estimated reach: 45K/mo
```

#### Step 2: Approve (Day 2, Marketing Lead)

```
Sarah reviews assets:
  ✅ Headline is catchy ("Welcome Bonus — Up to ₦50K Free Bets")
  ✅ Copy is compliant with legal (checked by Legal team)
  ✅ Bid strategy makes sense
  
Sarah clicks [Approve] in Asset section
  → Asset status changes to "approved"
  → Email sent to Performance Lead
```

#### Step 3: Launch (Day 3, Performance Lead)

```
Performance Lead opens Assets (approved):
  - Copies headline to Google Ads
  - Pastes landing page copy to landing page
  - Sets up tracking pixel (UTM: source=brandscope, campaign=welcome)
  - Creates ad group for "welcome bonus" keywords
  - Sets bid to $1.50
  
Clicks [Campaign Live] in dashboard:
  → Asset marked as "live" with timestamp
  → Email notification sent to brand owner + Sarah
  → Brandscope tracks performance
```

#### Step 4: Monitor (Days 4–7, Performance Lead)

```
Brandscope auto-pulls performance metrics from Google Ads:
  - Impressions: 12K (on track)
  - Clicks: 240 (2% CTR, healthy)
  - Conversions: 18 (7.5% conversion rate, strong)
  - Cost: $360 (on budget)

Daily summary email to Marketing Lead:
  "Welcome bonus campaign: 240 clicks, 18 signups, $360 spent ✅"

On Friday:
  Brandscope generates ROI summary:
    Spend: $360
    Revenue: $4,500 (18 signups × ₦250 avg value)
    ROI: 1150%
    Status: [Continue] [Optimize] [Pause]
```

#### Step 5: Next Week (Integrate Back into Intelligence)

```
Following Monday's scan:
  Brandscope compares:
  - Last week: You ranked #8 for "welcome bonus"
  - This week: You ranked #5 (↑ 3 positions from paid search)
  
New recommendation:
  "Increase budget by 25% — momentum is strong. Scale to other keywords."
```

---

## 4. Incident & Troubleshooting

### 4.1 User-Facing Issues

#### Issue: "Dashboard stuck at 'Processing...'"

**Symptom:** User sees loading spinners for 5+ minutes, no data appears

**Self-service fix:**
1. Refresh page (Cmd+R / Ctrl+R)
2. Wait 2–3 more minutes (scans can take up to 5 min)
3. Check /admin > Alerts: Is there a cost cap violation?
   - If yes: Top up DataForSEO balance
   - If no: Page may be stuck, proceed to next step

**Contact support:**
- In-app: Click "?" → "Report issue"
- Ops team: Check scan_jobs.status:
  - If "running": Scan is progressing, user can wait
  - If "failed": Show error_message to user
  - If "completed": Dashboard should load; if not, user's browser cache may be stale

---

#### Issue: "One competitor not showing data"

**Symptom:** Promotions section shows 4/5 competitors

**Possible causes:**
1. Researcher crashed for that competitor
2. API returned no data (e.g., no promos found)
3. RLS policy hiding the data

**Fix:**
1. Check feature_health:
   ```sql
   SELECT root_cause FROM feature_health
   WHERE feature_category='promotions' AND scan_job_id='...'
   ```
   - If "1/5 competitor promo signals failed": Partial data is expected
   
2. Check cache table:
   ```sql
   SELECT COUNT(*) FROM promotions_cache
   WHERE brand_id='...' AND scan_week='...'
   ```
   - If count=4: Data is there, but UI filtering may be wrong
   
3. Reassure user:
   ```
   "Promotions data for 4/5 competitors loaded successfully.
   The 5th competitor (Nairabet) had no new promos this week,
   so it's correctly blank.
   
   Last week: Nairabet showed 1 active promo.
   This week: 0 active promos (they paused it)."
   ```

---

### 4.2 Operator Runbook

#### Quick Decision Tree

```
Issue: Scan Failed

  ├─ Error message mentions "spend cap reached"?
  │  └─ User needs to top up or reduce modules
  │
  ├─ Error message mentions "DataForSEO balance"?
  │  └─ User's account low on credit
  │     └─ Ask them to top up via provider portal
  │
  ├─ Error message mentions "LLM timeout"?
  │  └─ Anthropic or OpenAI API slow
  │     └─ Recommend retry in 5 min
  │     └─ If persistent, escalate to engineering
  │
  ├─ Error message mentions "researcher timeout"?
  │  └─ Researcher took >90s
  │     └─ Module is complex (many competitors)
  │     └─ Either: (a) reduce competitor count, (b) disable module, (c) optimize researcher
  │
  ├─ Error message is blank or says "unknown error"?
  │  └─ Check DLQ: SELECT * FROM dead_letter_queue WHERE created_at > now() - 1 hour
  │     └─ If no entries: Edge function crashed (page on-call)
  │     └─ If entries exist: Log each one and contact engineering
  │
  └─ No error, just "running" for >10 min?
     └─ Check scan_jobs.progress_percentage
        └─ If 0%: No modules calling completeModule (infrastructure issue)
        └─ If >0%: Scan is progressing, user should wait
```

---

## 5. Decision Trees

### 5.1 Should We Run a Scan Now?

```
User has question: "Should I scan now or wait for Monday?"

Decision tree:

  Competitor launched a new campaign in last 3 days?
    ├─ Yes → RUN NOW (need fresh data to respond)
    │ └─ Cost: $12–$15 (one-time premium)
    │
    └─ No → WAIT until Monday
      └─ You already get fresh data at 6 AM UTC
```

---

### 5.2 Which Module Should We Disable?

```
We're over budget. We can disable 1 module to save 20%.

Candidate modules (from most expensive to least):

1. Social & Ads (Apify actors)
   Cost: $20–$30/scan
   Impact: Can't track competitor ad spend
   Recommendation: Disable if budget is critical
   
2. Customers (Apify reviews + DataForSEO backlinks)
   Cost: $15–$20/scan
   Impact: Can't track brand mentions or sentiment
   Recommendation: Disable if you don't care about brand perception
   
3. GEO/AEO (LLM queries to OpenAI/Anthropic)
   Cost: $10–$15/scan
   Impact: Can't see if brand appears in ChatGPT/Claude answers
   Recommendation: Keep (AI visibility is strategic)
   
4. Hiring & Signals (DataForSEO jobs)
   Cost: $5–$8/scan
   Impact: Can't track competitor hiring = growth signals
   Recommendation: Disable only if hiring isn't a signal
   
5. Traffic & SEO, Tech Stack, Promotions, Regulatory
   Cost: Low ($2–$5 each)
   Impact: Critical (don't disable)

RECOMMENDATION:
  - First, try disabling Social & Ads (save $25/scan)
  - If still over budget, disable Customers (save $17/scan)
  - Never disable Traffic, Tech Stack, Promotions, Regulatory
```

---

### 5.3 When to Call On-Call Engineer

```
Incident severity assessment:

LOW (can wait until business hours):
  ├─ One module timing out (partial data visible)
  ├─ User sees stale data (24h old)
  ├─ One brand's scan is slow (but completes)
  └─ Action: Log it, monitor, mention in ops standup

MEDIUM (escalate same day):
  ├─ 3+ modules timing out (significant data loss)
  ├─ Synthesis not generating (user sees no recommendations)
  ├─ DLQ has >10 failed tasks
  ├─ DataForSEO API completely down (all scans fail)
  └─ Action: Page on-call, diagnostic meeting with engineering

CRITICAL (page immediately):
  ├─ Entire system down (no scans completing)
  ├─ Data breach or RLS misconfiguration (users seeing other's data)
  ├─ All researcher functions failing (infrastructure issue)
  └─ Action: Incident response protocol, all-hands call

RULE: If unsure → escalate to Medium (better safe than sorry)
```

---

## Appendix: UI Reference

### Common User Paths

```
Login → Onboarding (4 steps) → Dashboard (ModuleStreamingView) → Dashboard (DashboardView)
                                                                  → Intelligence (drill-in)
                                                                  → Action Plan
                                                                  → Assets
                                                                  → Brand Chat
                                                                  → Admin Settings
```

### Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Shift + R` | Force refresh dashboard (clear cache) |
| `Cmd/Ctrl + K` | Open search (find competitor or keyword) |
| `?` | Help menu (report issue, guides) |
| `A` | Navigate to Action Plan |
| `I` | Navigate to Intelligence |

### Mobile vs Desktop

- **Desktop:** Full dashboard, all features
- **Mobile (tablet):** Responsive layout, sections stack vertically
- **Mobile (phone):** Simplified view (top 3 recommendations only)

---

**Document End**

*For API reference, see ARCHITECTURE_BLUEPRINT.md*
