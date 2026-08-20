import type { MarketPowerScoringConfig } from "./types";

/**
 * Log2-centred bounded Relative Strength transform — ENGINE VERSION
 * invariant. Calibration values (clamp bounds, center, scale) are DB config;
 * the log2 transform mechanics are not.
 *
 *   score = center + scale * clamp(log2(ratio), clampMin, clampMax)
 *
 * With the seeded defaults (center=50, scale=25, clamp=[-2,2]):
 *   0.5x -> 25, 1.0x -> 50, 2.0x -> 75, 4.0x -> 100
 *
 * If the brand's own Market Standing is unavailable, zero, or below the
 * confidence floor, Relative Strength is unavailable — never invent an
 * epsilon substitute. The caller must reweight Competitive Threat (see
 * reweight.ts) and lower confidence accordingly.
 */
export function calculateRelativeStrength(
  operatorMarketStanding: number,
  brandMarketStanding: number | null,
  config: MarketPowerScoringConfig
): { ratio: number | null; score: number | null } {
  if (brandMarketStanding === null || brandMarketStanding <= 0) {
    return { ratio: null, score: null };
  }

  const ratio = operatorMarketStanding / brandMarketStanding;
  const log2Ratio = Math.log2(ratio);
  const clamped = Math.min(
    Math.max(log2Ratio, config.relativeStrengthClampMin),
    config.relativeStrengthClampMax
  );
  const score = config.relativeStrengthCenter + config.relativeStrengthScale * clamped;

  return { ratio, score };
}
