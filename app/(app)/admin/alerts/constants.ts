// Shared constants for the brand-admin Alerts screen (Screen 22).
// Client-safe (no server-only deps) so the server action (validation/seed) and
// the client config form import the same closed sets — no drift.
//
// SHAPE NOTE — `alert_configs` is ONE ROW PER BRAND (brand_id is unique /
// isOneToOne in the schema), not a row-per-trigger. Each alert "trigger" maps to
// a boolean `*_enabled` column on that single row; a few triggers also carry a
// numeric `*_threshold_*` column. We therefore present the single config row as a
// flat list of trigger view-models, and writes patch the matching column(s) on
// that one row.

// Delivery channels offered at MVP. WhatsApp + Slack + webhook columns exist on
// the table but are Phase-2 / hard-excluded delivery (CLAUDE.md), so they are NOT
// offered in the UI. Only Email + In-app are real MVP channels.
//   - email_enabled (+ email_address) → "Email"
//   - in-app delivery is always on (no column; alerts always land in-product) → "In-app"
export const DELIVERY_CHANNELS = [
  { key: "email_enabled", label: "Email" },
  { key: "in_app", label: "In-app" },
] as const;

// Each trigger = one boolean column (+ optional threshold column) on alert_configs.
// `thresholdColumn`/`thresholdUnit`/`thresholdLabel` are present only for triggers
// that carry an editable numeric threshold.
export type AlertTrigger = {
  /** Stable id == the boolean enabled column on alert_configs. */
  enabledColumn: AlertEnabledColumn;
  label: string;
  /** Plain-language description of when this fires (matches alert tone of voice). */
  description: string;
  /** Whether this is a competitive-intelligence trigger or an operational one. */
  group: "competitive" | "operational";
  /** Optional editable numeric threshold column on alert_configs. */
  thresholdColumn?: AlertThresholdColumn;
  thresholdUnit?: string;
  thresholdLabel?: string;
};

// Boolean *_enabled columns we surface (exact column names on alert_configs).
export type AlertEnabledColumn =
  | "bonus_change_enabled"
  | "traffic_drop_enabled"
  | "new_ad_campaign_enabled"
  | "competitor_dark_enabled"
  | "new_market_entry_enabled"
  | "scan_completion_enabled"
  | "data_source_failure_enabled"
  | "feature_failure_enabled"
  | "credit_balance_low_enabled";

// Numeric threshold columns on alert_configs.
export type AlertThresholdColumn =
  | "bonus_change_threshold_pct"
  | "traffic_drop_threshold_pct"
  | "competitor_dark_on_ads_days";

// The catalogue, in display order. These are the standard MVP alert triggers and
// the exact set seedDefaultAlertConfigs enables on first setup.
export const ALERT_TRIGGERS: readonly AlertTrigger[] = [
  {
    enabledColumn: "bonus_change_enabled",
    label: "Competitor bonus change",
    description:
      "A competitor materially changes a welcome or reload bonus between scans.",
    group: "competitive",
    thresholdColumn: "bonus_change_threshold_pct",
    thresholdUnit: "%",
    thresholdLabel: "Min change",
  },
  {
    enabledColumn: "traffic_drop_enabled",
    label: "Competitor traffic drop",
    description: "A competitor's estimated traffic falls sharply week-over-week.",
    group: "competitive",
    thresholdColumn: "traffic_drop_threshold_pct",
    thresholdUnit: "%",
    thresholdLabel: "Min drop",
  },
  {
    enabledColumn: "new_ad_campaign_enabled",
    label: "New ad campaign",
    description: "A competitor launches a new paid ad campaign.",
    group: "competitive",
  },
  {
    enabledColumn: "competitor_dark_enabled",
    label: "Competitor goes dark on ads",
    description: "A competitor pauses paid advertising for several days.",
    group: "competitive",
    thresholdColumn: "competitor_dark_on_ads_days",
    thresholdUnit: "days",
    thresholdLabel: "After",
  },
  {
    enabledColumn: "new_market_entry_enabled",
    label: "New market entry",
    description: "A new competitor enters one of your tracked markets.",
    group: "competitive",
  },
  {
    enabledColumn: "scan_completion_enabled",
    label: "Weekly scan complete",
    description: "Your Monday scan finishes and a fresh action plan is ready.",
    group: "operational",
  },
  {
    enabledColumn: "data_source_failure_enabled",
    label: "Data source failure",
    description: "A data provider fails during a scan and a module is incomplete.",
    group: "operational",
  },
  {
    enabledColumn: "feature_failure_enabled",
    label: "Feature failure",
    description: "An intelligence module errors and could not be produced.",
    group: "operational",
  },
  {
    enabledColumn: "credit_balance_low_enabled",
    label: "Low credit balance",
    description: "Your account's scan credit balance is running low.",
    group: "operational",
  },
] as const;

// Defaults applied by seedDefaultAlertConfigs on first setup. Thresholds are sane
// starting points; all competitive triggers on, operational scan-complete on.
export const SEED_DEFAULTS = {
  bonus_change_enabled: true,
  bonus_change_threshold_pct: 10,
  traffic_drop_enabled: true,
  traffic_drop_threshold_pct: 20,
  new_ad_campaign_enabled: true,
  competitor_dark_enabled: true,
  competitor_dark_on_ads_days: 7,
  new_market_entry_enabled: true,
  scan_completion_enabled: true,
  data_source_failure_enabled: false,
  feature_failure_enabled: false,
  credit_balance_low_enabled: true,
  email_enabled: false,
} as const;

// Threshold input bounds (validated server-side too).
export const THRESHOLD_MIN = 1;
export const THRESHOLD_MAX = 100;
