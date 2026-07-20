import "server-only";

import type { HqTool } from "../types";
import { PERIOD_PARAM, validatePeriodArg, resolvePeriod, nowIso } from "./shared";

// get_campaign_performance — HONEST ADAPTER. Brandscope is a B2B SaaS; there is
// no marketing-campaign / ad-spend / conversions data source in the platform
// today. Rather than fabricate metrics, this tool returns notAvailable so the
// agent says the module isn't integrated.
//
// TODO(integration): when a real campaign source exists (e.g. an ad-platform
// connector or an internal campaigns table), replace the body below with a typed
// query returning { spend, impressions, conversions, underperforming[] } for the
// requested period. Keep the same tool name and parameters so the agent contract
// is stable.
const campaignPerformance: HqTool = {
  name: "get_campaign_performance",
  category: "campaigns",
  description:
    "Marketing-campaign performance (spend, conversions, underperforming campaigns) for a period. NOTE: no campaign data source is integrated yet — this returns a not-available signal rather than fabricated numbers.",
  parameters: { type: "object", properties: { ...PERIOD_PARAM }, additionalProperties: false },
  validate: validatePeriodArg,
  run: async (_ctx, args) => {
    const period = resolvePeriod(args.period);
    return {
      data: {
        available: false,
        message:
          "No marketing-campaign performance data source is integrated in Brandscope yet. Campaign spend, conversions and underperformance cannot be reported from available data.",
        requested_period: period.label,
      },
      dataUpdatedAt: nowIso(),
      sources: [{ service: "campaigns (not integrated)", dateRange: period.label }],
      notAvailable: true,
    };
  },
};

export const campaignTools: HqTool[] = [campaignPerformance];
