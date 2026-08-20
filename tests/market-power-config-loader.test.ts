import { describe, it, expect, vi } from "vitest";

const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle,
        }),
      }),
    }),
  }),
}));

import { loadActiveMarketPowerConfig } from "@/lib/market-power-engine/config-loader";

describe("loadActiveMarketPowerConfig — fail-closed", () => {
  it("throws when no active config exists (never falls back to a hardcoded default)", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(loadActiveMarketPowerConfig()).rejects.toThrow(/No active market_power_scoring_config/);
  });

  it("throws when the query itself errors", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "connection lost" } });
    await expect(loadActiveMarketPowerConfig()).rejects.toThrow(/connection lost/);
  });

  it("maps a valid active row into a fully-populated config", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: {
        id: "cfg-1",
        version: 1,
        status: "active",
        weight_customer_activity: 40,
        weight_acquisition_power: 25,
        weight_commercial_presence: 20,
        weight_customer_mindshare: 15,
        metric_weights: {},
        percentile_magnitude_alpha: 0.6,
        magnitude_fallback_spread: 1,
        minimum_operators_for_universe: 5,
        threshold_dominant_market_standing: 70,
        threshold_midmarket_market_standing: 40,
        threshold_challenger_market_standing: 20,
        threshold_dominant_overlap: 50,
        threshold_midmarket_overlap: 40,
        threshold_challenger_overlap: 35,
        threshold_challenger_momentum_pressure: 65,
        overlap_weight_product: 35,
        overlap_weight_keyword: 35,
        overlap_weight_channel: 30,
        threat_weight_overlap: 40,
        threat_weight_relative_strength: 35,
        threat_weight_momentum: 25,
        relative_strength_clamp_min: -2,
        relative_strength_clamp_max: 2,
        relative_strength_center: 50,
        relative_strength_scale: 25,
        momentum_lookback_periods: 6,
        momentum_strong_upward_threshold: 10,
        momentum_upward_threshold: 5,
        momentum_downward_threshold: -5,
        momentum_strong_downward_threshold: -10,
        momentum_stability_stddev_threshold: 5,
        momentum_pressure_strong_upward: 85,
        momentum_pressure_upward: 65,
        missing_dimension_coverage_threshold: 50,
        standing_confidence_weights: {},
        standing_confidence_contradiction_penalty: 15,
        position_confidence_weights: {},
      },
      error: null,
    });
    const config = await loadActiveMarketPowerConfig();
    expect(config.status).toBe("active");
    expect(config.weightCustomerActivity).toBe(40);
    expect(config.relativeStrengthClampMax).toBe(2);
  });
});
