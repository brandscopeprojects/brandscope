// Demo dataset — Brand-admin Alerts Config (Screen 22), RiversBet (Nigeria)
// sample. Renders the design populated (preview route + demo mode) so the real
// AdminAlertsConfig trigger list + AdminAlertsHistory table are visible instead
// of the "Set up alerts" empty state. Clearly sample data.
//
// Shape: `config` matches getAlertConfigs's AlertConfigView (the single
// alert_configs row projected onto the ALERT_TRIGGERS catalogue, in catalogue
// order); `history` matches getAlertHistory's AlertHistoryView[] (fired rows,
// latest first). Thresholds/timestamps stay numeric/ISO — the components render
// them in mono. Channels are limited to email + in-app (no Slack/WhatsApp).

import { ALERT_TRIGGERS } from "@/app/(app)/admin/alerts/constants";
import type {
  AlertConfigView,
  AlertTriggerView,
  AlertHistoryView,
} from "@/lib/data/admin-alerts";

// Per-trigger demo state, keyed by the stable enabledColumn. Threshold values
// are sane MVP starting points; competitive triggers mostly on, operational a
// realistic mix. Triggers without a threshold column read null.
const TRIGGER_STATE: Record<string, { enabled: boolean; threshold: number | null }> = {
  bonus_change_enabled: { enabled: true, threshold: 20 },
  traffic_drop_enabled: { enabled: true, threshold: 15 },
  new_ad_campaign_enabled: { enabled: true, threshold: null },
  competitor_dark_enabled: { enabled: true, threshold: 7 },
  new_market_entry_enabled: { enabled: true, threshold: null },
  scan_completion_enabled: { enabled: true, threshold: null },
  data_source_failure_enabled: { enabled: false, threshold: null },
  feature_failure_enabled: { enabled: false, threshold: null },
  credit_balance_low_enabled: { enabled: true, threshold: null },
};

// Project the catalogue onto the demo state, preserving display order — exactly
// what getAlertConfigs does against a real alert_configs row.
const triggers: AlertTriggerView[] = ALERT_TRIGGERS.map((trigger) => {
  const state = TRIGGER_STATE[trigger.enabledColumn];
  return {
    trigger,
    enabled: state?.enabled ?? false,
    threshold: trigger.thresholdColumn ? (state?.threshold ?? null) : null,
  };
});

export const DEMO_ADMIN_ALERTS: {
  config: AlertConfigView;
  history: AlertHistoryView[];
} = {
  config: {
    configId: "demo-alert-config",
    emailEnabled: true,
    emailAddress: "intel@riversbet.com",
    triggers,
  },
  history: [
    {
      id: "demo-alert-1",
      alertType: "bonus_change",
      alertLabel: "Competitor bonus change",
      message:
        "SportyBet raised its welcome bonus from ₦50,000 to ₦65,000 (+30%) — above your 20% trigger.",
      firedAt: "2026-06-27T06:12:00Z",
      status: "fired",
      deliveredVia: ["in_app", "email"],
    },
    {
      id: "demo-alert-2",
      alertType: "new_ad_campaign",
      alertLabel: "New ad campaign",
      message:
        "Bet9ja launched a new Meta ad campaign targeting Lagos for the weekend EPL fixtures.",
      firedAt: "2026-06-26T14:38:00Z",
      status: "fired",
      deliveredVia: ["in_app"],
    },
    {
      id: "demo-alert-3",
      alertType: "traffic_drop",
      alertLabel: "Competitor traffic drop",
      message:
        "BetKing's estimated weekly traffic fell 18% week-over-week — past your 15% trigger.",
      firedAt: "2026-06-25T07:01:00Z",
      status: "acknowledged",
      deliveredVia: ["in_app", "email"],
    },
    {
      id: "demo-alert-4",
      alertType: "new_market_entry",
      alertLabel: "New market entry",
      message:
        "Stake entered the Nigerian market with a localised .ng domain and a ₦100,000 sign-up offer.",
      firedAt: "2026-06-23T10:45:00Z",
      status: "fired",
      deliveredVia: ["in_app", "email"],
    },
    {
      id: "demo-alert-5",
      alertType: "competitor_dark",
      alertLabel: "Competitor goes dark on ads",
      message:
        "1xBet paused all paid advertising for 8 consecutive days — past your 7-day trigger.",
      firedAt: "2026-06-20T09:20:00Z",
      status: "resolved",
      deliveredVia: ["in_app"],
    },
    {
      id: "demo-alert-6",
      alertType: "scan_completion",
      alertLabel: "Weekly scan complete",
      message:
        "Your Monday scan finished — a fresh action plan with 6 recommendations is ready.",
      firedAt: "2026-06-22T05:30:00Z",
      status: "resolved",
      deliveredVia: ["in_app", "email"],
    },
  ],
};
