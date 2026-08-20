import type { DimensionKey, MarketPowerScoringConfig, MetricScoreResult, RawMetric } from "./types";
import { combinePercentileAndMagnitude, midrankPercentile, robustMagnitude } from "./normalization";
import { reweightAvailable } from "./reweight";

const DIMENSION_WEIGHT_KEY: Record<DimensionKey, keyof MarketPowerScoringConfig> = {
  customer_activity: "weightCustomerActivity",
  acquisition_power: "weightAcquisitionPower",
  commercial_presence: "weightCommercialPresence",
  customer_mindshare: "weightCustomerMindshare",
};

/**
 * Scores every operator's raw metric within one dimension against the
 * canonical market universe. No imputation: a metric with no comparable
 * evidence across the universe is simply absent from the per-operator input,
 * never zero-filled.
 */
export function scoreMetric(
  metric: RawMetric,
  universeValuesForMetric: number[],
  config: MarketPowerScoringConfig
): MetricScoreResult {
  const percentileComponent = midrankPercentile(metric.value, universeValuesForMetric);
  const magnitudeComponent = robustMagnitude(
    metric.value,
    universeValuesForMetric,
    metric.direction,
    config.magnitudeFallbackSpread
  );
  const metricScore = combinePercentileAndMagnitude(
    percentileComponent,
    magnitudeComponent,
    config.percentileMagnitudeAlpha
  );

  return { metricKey: metric.metricKey, operatorId: metric.operatorId, percentileComponent, magnitudeComponent, metricScore };
}

/**
 * Combines an operator's available metric scores within one dimension using
 * the DB-configured per-metric weights, reweighting over whichever metrics
 * actually have evidence for this operator.
 */
export function combineDimension(
  dimension: DimensionKey,
  metricScores: MetricScoreResult[], // all metric scores for this operator+dimension that have evidence
  config: MarketPowerScoringConfig
): { dimensionScore: number | null; effectiveWeights: Record<string, number> } {
  const metricWeightsForDimension = config.metricWeights[dimension] ?? {};
  const { value, effectiveWeights } = reweightAvailable(
    metricScores.map((m) => ({
      key: m.metricKey,
      weight: metricWeightsForDimension[m.metricKey] ?? 0,
      score: m.metricScore,
    }))
  );

  return { dimensionScore: value, effectiveWeights };
}

/**
 * Combines the four dimension scores into Market Standing using DB-configured
 * dimension weights, reweighting proportionally over whichever dimensions
 * have >= missingDimensionCoverageThreshold evidence coverage (caller decides
 * per-dimension availability upstream and passes null for excluded ones).
 * No concentration multiplier — this composite is the final Market Standing.
 */
export function combineMarketStanding(
  dimensionScores: Partial<Record<DimensionKey, number | null>>,
  config: MarketPowerScoringConfig
): { marketStanding: number | null; effectiveWeights: Record<string, number> } {
  const dimensions = Object.keys(DIMENSION_WEIGHT_KEY) as DimensionKey[];
  const { value, effectiveWeights } = reweightAvailable(
    dimensions.map((d) => ({
      key: d,
      weight: config[DIMENSION_WEIGHT_KEY[d]] as number,
      score: dimensionScores[d] ?? null,
    }))
  );

  return { marketStanding: value, effectiveWeights };
}
