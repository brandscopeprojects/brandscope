// Competitive Market Power Engine — shared types.
// Methodology reference: "Brandscope Competitive Market Power Engine —
// Methodology Freeze v1.0" (V1.5, approved). See supabase/migrations/27-31.

export type MarketPowerScoringConfig = {
  id: string;
  version: number;
  status: "draft" | "active" | "retired";

  weightCustomerActivity: number;
  weightAcquisitionPower: number;
  weightCommercialPresence: number;
  weightCustomerMindshare: number;
  metricWeights: Record<string, Record<string, number>>; // dimension -> metric -> weight

  percentileMagnitudeAlpha: number;
  magnitudeFallbackSpread: number;
  minimumOperatorsForUniverse: number;

  thresholdDominantMarketStanding: number;
  thresholdMidmarketMarketStanding: number;
  thresholdChallengerMarketStanding: number;
  thresholdDominantOverlap: number;
  thresholdMidmarketOverlap: number;
  thresholdChallengerOverlap: number;
  thresholdChallengerMomentumPressure: number;

  overlapWeightProduct: number;
  overlapWeightKeyword: number;
  overlapWeightChannel: number;

  threatWeightOverlap: number;
  threatWeightRelativeStrength: number;
  threatWeightMomentum: number;

  relativeStrengthClampMin: number;
  relativeStrengthClampMax: number;
  relativeStrengthCenter: number;
  relativeStrengthScale: number;

  momentumLookbackPeriods: number;
  momentumStrongUpwardThreshold: number;
  momentumUpwardThreshold: number;
  momentumDownwardThreshold: number;
  momentumStrongDownwardThreshold: number;
  momentumStabilityStddevThreshold: number;
  momentumPressureStrongUpward: number;
  momentumPressureUpward: number;

  missingDimensionCoverageThreshold: number;

  standingConfidenceWeights: Record<string, number>;
  standingConfidenceContradictionPenalty: number;
  positionConfidenceWeights: Record<string, number>;
};

export type Direction = "higher_is_better" | "lower_is_better";

export type RawMetric = {
  metricKey: string;
  operatorId: string;
  value: number;
  direction: Direction;
};

export type MetricScoreResult = {
  metricKey: string;
  operatorId: string;
  percentileComponent: number;
  magnitudeComponent: number;
  metricScore: number; // 0-100
};

export type DimensionKey =
  | "customer_activity"
  | "acquisition_power"
  | "commercial_presence"
  | "customer_mindshare";

export type MomentumTrend =
  | "strong_upward"
  | "upward"
  | "stable"
  | "downward"
  | "strong_downward"
  | "unavailable";

export type Tier = "dominant" | "mid_market" | "challenger" | "watch";

export type WeightedComponent = {
  key: string;
  weight: number;
  score: number | null; // null = unavailable, excluded + reweighted
};

export type ReweightedResult = {
  value: number | null; // null if ALL components unavailable
  effectiveWeights: Record<string, number>;
};
