import type { MarketPowerScoringConfig } from "./types";
import { reweightAvailable } from "./reweight";

const clamp0to100 = (n: number) => Math.min(100, Math.max(0, n));

export type StandingConfidenceInputs = {
  completeness: number | null; // 0-100: share of dimensions/metrics with evidence
  sourceReliability: number | null; // 0-100: direct/proxy appropriateness-weighted quality
  freshness: number | null; // 0-100
  independence: number | null; // 0-100: multiple independent sources vs one repeated
  universeCoverage: number | null; // 0-100: how much of the canonical universe has evidence
  contradictionSeverity: number; // 0-100, higher = more severe conflicts (always available; 0 if none found)
};

/**
 * operator_market_standing_confidence — Operator × Market scope. All
 * component weights and the contradiction penalty are DB config; only the
 * bounded aggregation mechanics are code (V1.5 §9).
 */
export function calculateStandingConfidence(
  inputs: StandingConfidenceInputs,
  config: MarketPowerScoringConfig
): number {
  const w = config.standingConfidenceWeights;
  const { value } = reweightAvailable([
    { key: "completeness", weight: w.completeness ?? 0, score: inputs.completeness },
    { key: "source_reliability", weight: w.source_reliability ?? 0, score: inputs.sourceReliability },
    { key: "freshness", weight: w.freshness ?? 0, score: inputs.freshness },
    { key: "independence", weight: w.independence ?? 0, score: inputs.independence },
    { key: "universe_coverage", weight: w.universe_coverage ?? 0, score: inputs.universeCoverage },
  ]);

  const base = value ?? 0;
  const penalty = (inputs.contradictionSeverity / 100) * config.standingConfidenceContradictionPenalty;
  return clamp0to100(base - penalty);
}

export type PositionConfidenceInputs = {
  standingConfidence: number;
  overlapCompleteness: number | null; // 0-100
  relativeStrengthAvailability: number | null; // 0 or 100 (unavailable vs available), or a graded quality score
};

/**
 * competitive_position_confidence — Brand × Market × Operator scope. Lets the
 * UI say "Market Standing is high-confidence while Competitive Threat remains
 * medium-confidence" when overlap/relative-strength evidence is incomplete.
 */
export function calculatePositionConfidence(
  inputs: PositionConfidenceInputs,
  config: MarketPowerScoringConfig
): number {
  const w = config.positionConfidenceWeights;
  const { value } = reweightAvailable([
    { key: "standing", weight: w.standing ?? 0, score: inputs.standingConfidence },
    {
      key: "overlap_completeness",
      weight: w.overlap_completeness ?? 0,
      score: inputs.overlapCompleteness,
    },
    {
      key: "relative_strength_availability",
      weight: w.relative_strength_availability ?? 0,
      score: inputs.relativeStrengthAvailability,
    },
  ]);

  return clamp0to100(value ?? 0);
}
