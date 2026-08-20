import type { MarketPowerScoringConfig } from "./types";
import { reweightAvailable } from "./reweight";

/**
 * Component-based Competitive Overlap (V1.5 §6/§10). Three required
 * components for V1: product, non-branded keyword, acquisition channel.
 * Each is a Jaccard-style intersection/union over canonical taxonomies
 * (product_categories, acquisition_channels, keyword_clusters) supplied as
 * DATA by the caller — this module does not invent taxonomy membership or
 * keyword clustering; that is an evidence-adapter responsibility, and
 * production keyword clusters must never be generated ad hoc by an LLM at
 * scoring time.
 */

function jaccard(a: Set<string>, b: Set<string>): number | null {
  const union = new Set(Array.from(a).concat(Array.from(b)));
  if (union.size === 0) return null; // no data on either side -> unavailable, not 0
  const intersection = Array.from(a).filter((x) => b.has(x)).length;
  return (intersection / union.size) * 100;
}

export type OverlapInputs = {
  brandProductCategories: Set<string>;
  operatorProductCategories: Set<string>;
  brandNonBrandedKeywordClusters: Set<string>; // branded-term exclusion is enforced upstream by the evidence adapter
  operatorNonBrandedKeywordClusters: Set<string>;
  brandAcquisitionChannels: Set<string>;
  operatorAcquisitionChannels: Set<string>;
};

export type OverlapResult = {
  competitiveOverlap: number | null;
  componentScores: {
    product: number | null;
    keyword: number | null;
    channel: number | null;
  };
  effectiveWeights: Record<string, number>;
};

export function calculateCompetitiveOverlap(
  inputs: OverlapInputs,
  config: MarketPowerScoringConfig
): OverlapResult {
  const product = jaccard(inputs.brandProductCategories, inputs.operatorProductCategories);
  const keyword = jaccard(
    inputs.brandNonBrandedKeywordClusters,
    inputs.operatorNonBrandedKeywordClusters
  );
  const channel = jaccard(inputs.brandAcquisitionChannels, inputs.operatorAcquisitionChannels);

  const { value, effectiveWeights } = reweightAvailable([
    { key: "product", weight: config.overlapWeightProduct, score: product },
    { key: "keyword", weight: config.overlapWeightKeyword, score: keyword },
    { key: "channel", weight: config.overlapWeightChannel, score: channel },
  ]);

  return {
    competitiveOverlap: value,
    componentScores: { product, keyword, channel },
    effectiveWeights,
  };
}
