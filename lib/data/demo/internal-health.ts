// DEMO / SAMPLE DATA — Internal-admin System Health (Screen 24,
// `/brandscope-admin/health`). Returned by getInternalHealth when
// NEXT_PUBLIC_DEMO_MODE=true and rendered by the PUBLIC /preview/internal-health
// route inside the dark InternalShell. Explicitly sample data — richly populated
// so the internal console is fully visible against the Screen-24 mockup.
//
// Shape matches InternalHealthData EXACTLY (the getInternalHealth return type):
// the four view models SystemStatusVM / FeatureHealthVM / CronJobVM / ApiHealthVM.
// All display formatting (timestamps "DD Mon YYYY, HH:MM UTC", latency "NNN ms",
// error rate "N.N%", duration "Nm Ns") is pre-rendered here to match exactly what
// the real data layer's formatters emit — these are strings on the VMs, so the
// demo must mirror that output, not raw numbers.
//
// Tone discipline (ui-constraints §2 / §12 / StatusPill):
//   good=green  → Healthy / Passed / Up / Completed
//   warn=amber  → Degraded / Partial / Slow
//   bad=red     → Critical / Failed / Down
//   neutral=grey→ N/A (not_applicable_mvp / Phase-2 features)
//
// Overall posture: HEALTHY, uptime ~99.9%, 0 active incidents. The feature table
// carries a deliberate spread (passed / partial / failed / N/A) across modules so
// every pill tone is exercised, but nothing in the live system path is red.

import type { InternalHealthData } from "@/lib/data/internal-health";

export const DEMO_INTERNAL_HEALTH: InternalHealthData = {
  // ── System status strip ──────────────────────────────────────────────────
  systemStatus: {
    overallStatusLabel: "Healthy",
    overallStatusTone: "good",
    activeIncidents: 0,
    services: [
      {
        id: "svc-api",
        name: "API Gateway",
        statusLabel: "Healthy",
        tone: "good",
        detail: "Uptime 99.94% (30d) · p95 latency 212 ms",
        checkedAt: "29 Jun 2026, 06:00 UTC",
      },
      {
        id: "svc-db",
        name: "Database (Postgres)",
        statusLabel: "Healthy",
        tone: "good",
        detail: "Connections 38/100 · replication lag 0.4 s",
        checkedAt: "29 Jun 2026, 06:00 UTC",
      },
      {
        id: "svc-queue",
        name: "Job Queue (pgmq)",
        statusLabel: "Healthy",
        tone: "good",
        detail: "Depth 0 · DLQ empty · last drain 06:00 UTC",
        checkedAt: "29 Jun 2026, 06:00 UTC",
      },
    ],
  },

  // ── Feature health (latest per feature, mixed tones across modules) ───────
  features: [
    {
      id: "feat-dashboard",
      feature: "Weekly Dashboard",
      category: "Intelligence",
      tier: "Core",
      statusLabel: "Passed",
      tone: "good",
      lastChecked: "29 Jun 2026, 06:02 UTC",
      notes: "—",
    },
    {
      id: "feat-market-intel",
      feature: "Market Intelligence",
      category: "Intelligence",
      tier: "Core",
      statusLabel: "Passed",
      tone: "good",
      lastChecked: "29 Jun 2026, 06:02 UTC",
      notes: "—",
    },
    {
      id: "feat-traffic-seo",
      feature: "Traffic & SEO",
      category: "Intelligence",
      tier: "Core",
      statusLabel: "Passed",
      tone: "good",
      lastChecked: "29 Jun 2026, 06:03 UTC",
      notes: "—",
    },
    {
      id: "feat-geo",
      feature: "GEO / AEO Visibility",
      category: "Intelligence",
      tier: "Core",
      statusLabel: "Partial",
      tone: "warn",
      lastChecked: "29 Jun 2026, 06:04 UTC",
      notes: "Perplexity probe degraded — 3 of 4 platforms returned this cycle.",
    },
    {
      id: "feat-regulatory",
      feature: "Regulatory Compliance",
      category: "Intelligence",
      tier: "Core",
      statusLabel: "Passed",
      tone: "good",
      lastChecked: "29 Jun 2026, 06:04 UTC",
      notes: "—",
    },
    {
      id: "feat-tech-stack",
      feature: "Tech Stack & Ad Network",
      category: "Intelligence",
      tier: "Core",
      statusLabel: "Passed",
      tone: "good",
      lastChecked: "29 Jun 2026, 06:05 UTC",
      notes: "—",
    },
    {
      id: "feat-action-plan",
      feature: "Action Plan Generation",
      category: "Synthesis",
      tier: "Core",
      statusLabel: "Passed",
      tone: "good",
      lastChecked: "29 Jun 2026, 06:07 UTC",
      notes: "6 recommendations generated, all evidence-linked.",
    },
    {
      id: "feat-asset-gen",
      feature: "Asset Generation",
      category: "Synthesis",
      tier: "Core",
      statusLabel: "Passed",
      tone: "good",
      lastChecked: "29 Jun 2026, 06:08 UTC",
      notes: "OpenAI moderation pass-through clean.",
    },
    {
      id: "feat-brand-chat",
      feature: "Brand Chat",
      category: "Conversational",
      tier: "Core",
      statusLabel: "Passed",
      tone: "good",
      lastChecked: "29 Jun 2026, 05:58 UTC",
      notes: "—",
    },
    {
      id: "feat-between-cycle",
      feature: "Between-Cycle Alerts",
      category: "Monitoring",
      tier: "Core",
      statusLabel: "Passed",
      tone: "good",
      lastChecked: "29 Jun 2026, 04:00 UTC",
      notes: "—",
    },
    {
      id: "feat-hiring",
      feature: "Hiring & Signals",
      category: "Intelligence",
      tier: "Phase 2",
      statusLabel: "N/A",
      tone: "neutral",
      lastChecked: "—",
      notes: "Deferred to Phase 2 (Firecrawl) — not applicable at MVP.",
    },
    {
      id: "feat-social",
      feature: "Social Intelligence",
      category: "Intelligence",
      tier: "Phase 2",
      statusLabel: "N/A",
      tone: "neutral",
      lastChecked: "—",
      notes: "Placeholder at MVP (Apify) — not applicable.",
    },
    {
      id: "feat-app-reviews",
      feature: "App Review Ingestion",
      category: "Intelligence",
      tier: "Optional",
      statusLabel: "Failed",
      tone: "bad",
      lastChecked: "29 Jun 2026, 06:06 UTC",
      notes: "DataForSEO app-reviews endpoint 502 — retried 3×, no rows this cycle. Non-blocking.",
    },
  ],

  // ── Cron jobs (recent runs, latest first) ─────────────────────────────────
  cronJobs: [
    {
      id: "cron-weekly-scan",
      jobName: "weekly-scan-trigger",
      schedule: "0 6 * * 1",
      statusLabel: "Completed",
      tone: "good",
      lastRun: "29 Jun 2026, 06:00 UTC",
      duration: "2m 41s",
      notes: "—",
    },
    {
      id: "cron-between-cycle",
      jobName: "between-cycle-monitor",
      schedule: "0 */6 * * *",
      statusLabel: "Completed",
      tone: "good",
      lastRun: "29 Jun 2026, 04:00 UTC",
      duration: "18.42s",
      notes: "2 competitor changes detected, 1 alert fired.",
    },
    {
      id: "cron-dlq-drain",
      jobName: "dead-letter-queue-drain",
      schedule: "*/30 * * * *",
      statusLabel: "Completed",
      tone: "good",
      lastRun: "29 Jun 2026, 05:30 UTC",
      duration: "0.84s",
      notes: "Queue empty.",
    },
    {
      id: "cron-cache-warm",
      jobName: "cache-population",
      schedule: "0 6 * * 1",
      statusLabel: "Completed",
      tone: "good",
      lastRun: "29 Jun 2026, 06:09 UTC",
      duration: "1m 12s",
      notes: "—",
    },
    {
      id: "cron-api-health",
      jobName: "api-health-probe",
      schedule: "*/15 * * * *",
      statusLabel: "Completed",
      tone: "good",
      lastRun: "29 Jun 2026, 06:00 UTC",
      duration: "3.07s",
      notes: "4 providers probed.",
    },
  ],

  // ── External API health (latest per provider) ─────────────────────────────
  apis: [
    {
      id: "api-dataforseo",
      provider: "DataForSEO",
      statusLabel: "Healthy",
      tone: "good",
      latency: "412 ms",
      errorRate: "0.40%",
      lastChecked: "29 Jun 2026, 06:00 UTC",
    },
    {
      id: "api-anthropic",
      provider: "Anthropic",
      statusLabel: "Healthy",
      tone: "good",
      latency: "1280 ms",
      errorRate: "0.10%",
      lastChecked: "29 Jun 2026, 06:00 UTC",
    },
    {
      id: "api-openai",
      provider: "OpenAI",
      statusLabel: "Degraded",
      tone: "warn",
      latency: "2840 ms",
      errorRate: "2.30%",
      lastChecked: "29 Jun 2026, 06:00 UTC",
    },
    {
      id: "api-detectzestack",
      provider: "DetectZeStack",
      statusLabel: "Healthy",
      tone: "good",
      latency: "640 ms",
      errorRate: "0.00%",
      lastChecked: "29 Jun 2026, 06:00 UTC",
    },
  ],
};
