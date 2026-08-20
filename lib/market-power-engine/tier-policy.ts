import type { MarketPowerScoringConfig, Tier } from "./types";

/**
 * Deterministic tier truth table — ENGINE VERSION invariant (V1.5 final,
 * frozen). Band thresholds/overlap minimums/momentum minimum are DB config;
 * the evaluation STRUCTURE (mutually exclusive bands, relevance gate that
 * only ever resolves to that tier or Watch — never a downgrade cascade
 * through other bands) is not.
 *
 * Relative Strength is explicitly NOT a tier prerequisite — it is a
 * Competitive Threat input only. Momentum pressure is required only for
 * Challenger.
 */
export function assignTier(
  marketStanding: number,
  competitiveOverlap: number | null,
  momentumPressureScore: number | null,
  config: MarketPowerScoringConfig
): Tier {
  const overlap = competitiveOverlap ?? 0;

  if (marketStanding >= config.thresholdDominantMarketStanding) {
    return overlap >= config.thresholdDominantOverlap ? "dominant" : "watch";
  }

  if (marketStanding >= config.thresholdMidmarketMarketStanding) {
    return overlap >= config.thresholdMidmarketOverlap ? "mid_market" : "watch";
  }

  if (marketStanding >= config.thresholdChallengerMarketStanding) {
    const hasUpwardMomentum =
      momentumPressureScore !== null &&
      momentumPressureScore >= config.thresholdChallengerMomentumPressure;
    return overlap >= config.thresholdChallengerOverlap && hasUpwardMomentum
      ? "challenger"
      : "watch";
  }

  return "watch";
}
