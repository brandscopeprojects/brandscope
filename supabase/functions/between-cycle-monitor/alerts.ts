// Alert-matching for the between-cycle monitor. Maps an unprocessed
// competitor_changes row to the alert_configs flags + thresholds of an affected
// brand and decides whether an alert fires — WITHOUT regenerating recommendations
// (data-flow-rules.md §3 rule 5: between-cycle alerts INSERT alert_history +
// UPDATE fields only; recs need a full Drafter+Auditor on-demand scan).
//
// Channels: in-app + email only. Slack / WhatsApp / webhook are EXCLUDED at MVP,
// and email delivery via Resend is excluded too — so an "email" alert is recorded
// as an alert_history row (logged delivery) with a TODO for real send-out.

// Minimal structural shapes (inlined — Edge Functions must not import outside
// supabase/functions, or the Supabase deploy bundle breaks). Mirror the columns
// of alert_configs / competitor_changes used here.
type AlertConfig = {
  email_enabled?: boolean | null;
  email_address?: string | null;
  bonus_change_enabled?: boolean | null;
  bonus_change_threshold_pct?: number | null;
  traffic_drop_enabled?: boolean | null;
  traffic_drop_threshold_pct?: number | null;
  new_ad_campaign_enabled?: boolean | null;
  new_market_entry_enabled?: boolean | null;
  competitor_dark_enabled?: boolean | null;
};
type CompetitorChange = {
  change_type?: string | null;
  impact_level?: string | null;
  summary?: string | null;
  detail?: unknown;
};

export type AlertDecision = {
  fire: boolean;
  alert_type: string;
  message: string;
  /** Channels we *would* deliver via — in-app is always on; email if enabled. */
  delivered_via: string[];
};

/** Numeric magnitude pulled from a change's detail jsonb (best-effort). */
function detailNumber(detail: unknown, ...keys: string[]): number | null {
  if (!detail || typeof detail !== "object") return null;
  const obj = detail as Record<string, unknown>;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return Math.abs(v);
  }
  return null;
}

/**
 * Decide whether a competitor change should fire an alert for a given brand,
 * honouring that brand's alert_configs enable flags + thresholds. Returns
 * fire=false when the matching alert type is disabled or under threshold.
 *
 * change_type values are produced by the researchers / detectzestack webhook
 * (e.g. 'promotion', 'bonus', 'traffic', 'ad_campaign', 'market_entry',
 * 'tech_stack', 'dark'). We map each to the relevant alert_configs column.
 */
export function evaluateChange(
  change: CompetitorChange,
  cfg: AlertConfig | null,
  competitorName: string,
): AlertDecision {
  const no: AlertDecision = { fire: false, alert_type: "", message: "", delivered_via: [] };
  if (!cfg) return no;

  const type = (change.change_type ?? "").toLowerCase();
  const impact = (change.impact_level ?? "").toLowerCase();
  const summary = change.summary ?? "competitor change detected";

  // Channels: in-app always; email only if the brand enabled email delivery.
  const channels = ["in_app"];
  if (cfg.email_enabled && cfg.email_address) channels.push("email");
  // NOTE: cfg.slack_enabled / cfg.whatsapp_enabled / cfg.webhook_enabled are
  // intentionally ignored — those channels are excluded at MVP.

  const fire = (alert_type: string): AlertDecision => ({
    fire: true,
    alert_type,
    message: `${competitorName}: ${summary}`,
    delivered_via: channels,
  });

  // --- map change_type → alert_configs flag (+ threshold where one exists) ---

  // Bonus / promotion size change.
  if (type === "bonus" || type === "promotion" || type === "promotions") {
    if (!cfg.bonus_change_enabled) return no;
    const pct = detailNumber(change.detail, "change_pct", "pct", "delta_pct");
    const threshold = cfg.bonus_change_threshold_pct ?? 0;
    if (pct != null && pct < threshold) return no; // under threshold → suppress
    return fire("bonus_change");
  }

  // Traffic drop.
  if (type === "traffic" || type === "traffic_drop") {
    if (!cfg.traffic_drop_enabled) return no;
    const pct = detailNumber(change.detail, "drop_pct", "change_pct", "pct");
    const threshold = cfg.traffic_drop_threshold_pct ?? 0;
    if (pct != null && pct < threshold) return no;
    return fire("traffic_drop");
  }

  // New ad campaign.
  if (type === "ad_campaign" || type === "new_ad" || type === "ads" || type === "ad") {
    if (!cfg.new_ad_campaign_enabled) return no;
    return fire("new_ad_campaign");
  }

  // New market entry.
  if (type === "market_entry" || type === "new_market" || type === "market") {
    if (!cfg.new_market_entry_enabled) return no;
    return fire("new_market_entry");
  }

  // Competitor went dark on ads (no day-count tracking between cycles; fire on
  // the flagged 'dark' change and let the config's day threshold gate detection
  // upstream).
  if (type === "dark" || type === "competitor_dark") {
    if (!cfg.competitor_dark_enabled) return no;
    return fire("competitor_dark");
  }

  // Fallback: high-impact change with no specific config flag → only surface if
  // the brand opted into market-entry style alerts (most permissive enabled).
  if (impact === "high" || impact === "critical") {
    if (cfg.new_market_entry_enabled) return fire("competitor_change");
  }

  return no;
}
