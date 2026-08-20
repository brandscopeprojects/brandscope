import type { MarketPowerScoringConfig } from "./types";
import { reweightAvailable } from "./reweight";

export type ThreatInputs = {
  competitiveOverlap: number | null;
  relativeStrengthScore: number | null;
  momentumPressureScore: number | null;
};

export type ThreatResult = {
  competitiveThreat: number | null;
  effectiveWeights: Record<string, number>;
};

/**
 * Competitive Threat = weighted combination of Overlap, Relative Strength and
 * upward Momentum Pressure, reweighted over whichever components are
 * available (reweight.ts) — never substituting 0/50 for a missing one.
 */
export function calculateCompetitiveThreat(
  inputs: ThreatInputs,
  config: MarketPowerScoringConfig
): ThreatResult {
  const { value, effectiveWeights } = reweightAvailable([
    { key: "overlap", weight: config.threatWeightOverlap, score: inputs.competitiveOverlap },
    {
      key: "relative_strength",
      weight: config.threatWeightRelativeStrength,
      score: inputs.relativeStrengthScore,
    },
    {
      key: "momentum",
      weight: config.threatWeightMomentum,
      score: inputs.momentumPressureScore,
    },
  ]);

  return { competitiveThreat: value, effectiveWeights };
}
