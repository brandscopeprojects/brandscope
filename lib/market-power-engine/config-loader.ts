import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MarketPowerScoringConfig } from "./types";

/**
 * Loads the single ACTIVE market_power_scoring_config row. No tunable
 * business value in this engine may fall back to a hardcoded TypeScript
 * constant — a missing or invalid active config blocks calculation.
 */
export async function loadActiveMarketPowerConfig(): Promise<MarketPowerScoringConfig> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("market_power_scoring_config")
    .select("*")
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`market_power_scoring_config load failed: ${error.message}`);
  }
  if (!data) {
    throw new Error(
      "No active market_power_scoring_config found. Calculation blocked — a platform admin must activate a config version before the engine can run."
    );
  }

  return mapRow(data);
}

function mapRow(row: Record<string, unknown>): MarketPowerScoringConfig {
  const num = (key: string) => Number(row[key]);
  return {
    id: String(row.id),
    version: num("version"),
    status: row.status as MarketPowerScoringConfig["status"],

    weightCustomerActivity: num("weight_customer_activity"),
    weightAcquisitionPower: num("weight_acquisition_power"),
    weightCommercialPresence: num("weight_commercial_presence"),
    weightCustomerMindshare: num("weight_customer_mindshare"),
    metricWeights: (row.metric_weights as Record<string, Record<string, number>>) ?? {},

    percentileMagnitudeAlpha: num("percentile_magnitude_alpha"),
    magnitudeFallbackSpread: num("magnitude_fallback_spread"),
    minimumOperatorsForUniverse: num("minimum_operators_for_universe"),

    thresholdDominantMarketStanding: num("threshold_dominant_market_standing"),
    thresholdMidmarketMarketStanding: num("threshold_midmarket_market_standing"),
    thresholdChallengerMarketStanding: num("threshold_challenger_market_standing"),
    thresholdDominantOverlap: num("threshold_dominant_overlap"),
    thresholdMidmarketOverlap: num("threshold_midmarket_overlap"),
    thresholdChallengerOverlap: num("threshold_challenger_overlap"),
    thresholdChallengerMomentumPressure: num("threshold_challenger_momentum_pressure"),

    overlapWeightProduct: num("overlap_weight_product"),
    overlapWeightKeyword: num("overlap_weight_keyword"),
    overlapWeightChannel: num("overlap_weight_channel"),

    threatWeightOverlap: num("threat_weight_overlap"),
    threatWeightRelativeStrength: num("threat_weight_relative_strength"),
    threatWeightMomentum: num("threat_weight_momentum"),

    relativeStrengthClampMin: num("relative_strength_clamp_min"),
    relativeStrengthClampMax: num("relative_strength_clamp_max"),
    relativeStrengthCenter: num("relative_strength_center"),
    relativeStrengthScale: num("relative_strength_scale"),

    momentumLookbackPeriods: num("momentum_lookback_periods"),
    momentumStrongUpwardThreshold: num("momentum_strong_upward_threshold"),
    momentumUpwardThreshold: num("momentum_upward_threshold"),
    momentumDownwardThreshold: num("momentum_downward_threshold"),
    momentumStrongDownwardThreshold: num("momentum_strong_downward_threshold"),
    momentumStabilityStddevThreshold: num("momentum_stability_stddev_threshold"),
    momentumPressureStrongUpward: num("momentum_pressure_strong_upward"),
    momentumPressureUpward: num("momentum_pressure_upward"),

    missingDimensionCoverageThreshold: num("missing_dimension_coverage_threshold"),

    standingConfidenceWeights: (row.standing_confidence_weights as Record<string, number>) ?? {},
    standingConfidenceContradictionPenalty: num("standing_confidence_contradiction_penalty"),
    positionConfidenceWeights: (row.position_confidence_weights as Record<string, number>) ?? {},
  };
}
