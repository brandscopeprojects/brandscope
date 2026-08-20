import { describe, it, expect } from "vitest";
import { midrankPercentile, robustMagnitude, combinePercentileAndMagnitude } from "@/lib/market-power-engine/normalization";
import { reweightAvailable } from "@/lib/market-power-engine/reweight";
import { calculateRelativeStrength } from "@/lib/market-power-engine/relative-strength";
import { calculateMomentum } from "@/lib/market-power-engine/momentum";
import { assignTier } from "@/lib/market-power-engine/tier-policy";
import { calculateCompetitiveThreat } from "@/lib/market-power-engine/competitive-threat";
import { calculateCompetitiveOverlap } from "@/lib/market-power-engine/overlap";
import type { MarketPowerScoringConfig } from "@/lib/market-power-engine/types";

const CONFIG: MarketPowerScoringConfig = {
  id: "test-config",
  version: 1,
  status: "active",
  weightCustomerActivity: 40,
  weightAcquisitionPower: 25,
  weightCommercialPresence: 20,
  weightCustomerMindshare: 15,
  metricWeights: {},
  percentileMagnitudeAlpha: 0.6,
  magnitudeFallbackSpread: 1,
  minimumOperatorsForUniverse: 5,
  thresholdDominantMarketStanding: 70,
  thresholdMidmarketMarketStanding: 40,
  thresholdChallengerMarketStanding: 20,
  thresholdDominantOverlap: 50,
  thresholdMidmarketOverlap: 40,
  thresholdChallengerOverlap: 35,
  thresholdChallengerMomentumPressure: 65,
  overlapWeightProduct: 35,
  overlapWeightKeyword: 35,
  overlapWeightChannel: 30,
  threatWeightOverlap: 40,
  threatWeightRelativeStrength: 35,
  threatWeightMomentum: 25,
  relativeStrengthClampMin: -2,
  relativeStrengthClampMax: 2,
  relativeStrengthCenter: 50,
  relativeStrengthScale: 25,
  momentumLookbackPeriods: 6,
  momentumStrongUpwardThreshold: 10,
  momentumUpwardThreshold: 5,
  momentumDownwardThreshold: -5,
  momentumStrongDownwardThreshold: -10,
  momentumStabilityStddevThreshold: 5,
  momentumPressureStrongUpward: 85,
  momentumPressureUpward: 65,
  missingDimensionCoverageThreshold: 50,
  standingConfidenceWeights: { completeness: 0.25, source_reliability: 0.25, freshness: 0.25, independence: 0.15, universe_coverage: 0.1 },
  standingConfidenceContradictionPenalty: 15,
  positionConfidenceWeights: { standing: 0.6, overlap_completeness: 0.25, relative_strength_availability: 0.15 },
};

describe("midrankPercentile", () => {
  it("highest unique value receives 100, lowest receives 0", () => {
    const universe = [100, 99, 98, 97];
    expect(midrankPercentile(100, universe)).toBe(100);
    expect(midrankPercentile(97, universe)).toBe(0);
  });

  it("does not return 75 for the top of a 4-operator universe (the rejected bug)", () => {
    const universe = [100, 99, 98, 97];
    expect(midrankPercentile(100, universe)).not.toBe(75);
  });

  it("ties share an identical midrank", () => {
    const universe = [100, 50, 50, 10];
    const rank = midrankPercentile(50, universe);
    expect(midrankPercentile(50, universe)).toBe(rank);
    // both 50s must be equal; count_below=1, count_equal=2 -> (1+0.5)/3*100=50
    expect(rank).toBeCloseTo(50, 5);
  });

  it("throws on a universe smaller than 2 (caller must gate on minimumOperatorsForUniverse)", () => {
    expect(() => midrankPercentile(100, [100])).toThrow();
  });
});

describe("robustMagnitude — preserves distance percentile erases", () => {
  it("gives a higher magnitude score to a dominant leader than to a barely-ahead leader", () => {
    const tightMarket = [100, 99, 98, 97]; // barely ahead
    const concentratedMarket = [100, 30, 20, 10]; // genuinely dominant
    const tightScore = robustMagnitude(100, tightMarket, "higher_is_better", 1);
    const dominantScore = robustMagnitude(100, concentratedMarket, "higher_is_better", 1);
    expect(dominantScore).toBeGreaterThan(tightScore);
  });

  it("operator at the median scores ~50", () => {
    const universe = [10, 20, 30, 40, 50];
    expect(robustMagnitude(30, universe, "higher_is_better", 1)).toBeCloseTo(50, 0);
  });
});

describe("combinePercentileAndMagnitude", () => {
  it("blends using alpha", () => {
    expect(combinePercentileAndMagnitude(100, 0, 0.6)).toBeCloseTo(60, 5);
    expect(combinePercentileAndMagnitude(0, 100, 0.6)).toBeCloseTo(40, 5);
  });
});

describe("reweightAvailable", () => {
  it("reweights proportionally when a component is missing (40/25/20/15 -> 41.67/33.33/25 when Activity missing)", () => {
    const { value, effectiveWeights } = reweightAvailable([
      { key: "activity", weight: 40, score: null },
      { key: "acquisition", weight: 25, score: 60 },
      { key: "commercial", weight: 20, score: 80 },
      { key: "mindshare", weight: 15, score: 40 },
    ]);
    expect(effectiveWeights.acquisition).toBeCloseTo(41.6667, 3);
    expect(effectiveWeights.commercial).toBeCloseTo(33.3333, 3);
    expect(effectiveWeights.mindshare).toBeCloseTo(25, 3);
    expect(value).not.toBeNull();
  });

  it("never substitutes 0 or 50 for missing — returns null when everything is missing", () => {
    const { value } = reweightAvailable([
      { key: "a", weight: 40, score: null },
      { key: "b", weight: 60, score: null },
    ]);
    expect(value).toBeNull();
  });
});

describe("calculateRelativeStrength — log2-centred bounded transform", () => {
  it.each([
    [0.5, 25],
    [1.0, 50],
    [2.0, 75],
    [4.0, 100],
  ])("ratio %f -> score %f", (ratio, expected) => {
    const operatorStanding = ratio * 100;
    const { score } = calculateRelativeStrength(operatorStanding, 100, CONFIG);
    expect(score).toBeCloseTo(expected, 5);
  });

  it("is unavailable when brand market standing is null or zero", () => {
    expect(calculateRelativeStrength(50, null, CONFIG).score).toBeNull();
    expect(calculateRelativeStrength(50, 0, CONFIG).score).toBeNull();
  });
});

describe("calculateMomentum", () => {
  it("is unavailable with fewer than 2 historical points", () => {
    expect(calculateMomentum([50], CONFIG).trend).toBe("unavailable");
    expect(calculateMomentum([], CONFIG).trend).toBe("unavailable");
  });

  it("classifies strong upward and assigns positive pressure", () => {
    const result = calculateMomentum([40, 55, 70], CONFIG); // avg delta = 15
    expect(result.trend).toBe("strong_upward");
    expect(result.pressureScore).toBe(85);
  });

  it("stable and downward contribute zero pressure (never negative, never a threat credit)", () => {
    const stable = calculateMomentum([50, 51, 50], CONFIG);
    expect(stable.trend).toBe("stable");
    expect(stable.pressureScore).toBeNull();

    const downward = calculateMomentum([70, 63, 55], CONFIG); // avg delta ~ -7.5
    expect(downward.trend).toBe("downward");
    expect(downward.pressureScore).toBeNull();
  });
});

describe("assignTier — mutually exclusive bands, no downgrade cascade", () => {
  it("a very strong operator with insufficient overlap is Watch, not Challenger (the rejected fallthrough bug)", () => {
    // Market Standing 85 falls in the dominant band (>=70); overlap 37 fails
    // the dominant gate (needs >=50) -> must be Watch, never cascade down
    // into mid_market/challenger bands.
    expect(assignTier(85, 37, null, CONFIG)).toBe("watch");
  });

  it("dominant: high standing + sufficient overlap, no relative-strength prerequisite", () => {
    expect(assignTier(85, 60, null, CONFIG)).toBe("dominant");
  });

  it("mid_market: mid-band standing + sufficient overlap", () => {
    expect(assignTier(50, 45, null, CONFIG)).toBe("mid_market");
    expect(assignTier(50, 30, null, CONFIG)).toBe("watch");
  });

  it("challenger requires overlap AND upward momentum pressure", () => {
    expect(assignTier(25, 40, 70, CONFIG)).toBe("challenger");
    expect(assignTier(25, 40, null, CONFIG)).toBe("watch"); // no momentum -> watch
    expect(assignTier(25, 40, 30, CONFIG)).toBe("watch"); // momentum below threshold -> watch
  });

  it("below all bands is watch", () => {
    expect(assignTier(10, 90, 90, CONFIG)).toBe("watch");
  });
});

describe("calculateCompetitiveThreat", () => {
  it("reweights when momentum is unavailable instead of inserting 0/50", () => {
    const withMomentum = calculateCompetitiveThreat(
      { competitiveOverlap: 60, relativeStrengthScore: 50, momentumPressureScore: 65 },
      CONFIG
    );
    const withoutMomentum = calculateCompetitiveThreat(
      { competitiveOverlap: 60, relativeStrengthScore: 50, momentumPressureScore: null },
      CONFIG
    );
    // Same overlap/relative-strength scores (60/50, equal weights 40/35) ->
    // reweighted result should equal a straight weighted average of the two.
    expect(withoutMomentum.competitiveThreat).toBeCloseTo((40 * 60 + 35 * 50) / 75, 5);
    expect(withoutMomentum.competitiveThreat).not.toBe(withMomentum.competitiveThreat);
  });

  it("is null when every component is unavailable", () => {
    const result = calculateCompetitiveThreat(
      { competitiveOverlap: null, relativeStrengthScore: null, momentumPressureScore: null },
      CONFIG
    );
    expect(result.competitiveThreat).toBeNull();
  });
});

describe("calculateCompetitiveOverlap — component-based, Jaccard per taxonomy", () => {
  it("computes product/keyword/channel independently and combines with config weights", () => {
    const result = calculateCompetitiveOverlap(
      {
        brandProductCategories: new Set(["sports_betting", "live_betting"]),
        operatorProductCategories: new Set(["sports_betting", "virtual_sports"]),
        brandNonBrandedKeywordClusters: new Set(["online_betting_ke", "sportsbook_app"]),
        operatorNonBrandedKeywordClusters: new Set(["online_betting_ke", "virtual_betting"]),
        brandAcquisitionChannels: new Set(["google_ads", "affiliates"]),
        operatorAcquisitionChannels: new Set(["google_ads", "app_store"]),
      },
      CONFIG
    );
    expect(result.componentScores.product).toBeCloseTo((1 / 3) * 100, 5);
    expect(result.componentScores.keyword).toBeCloseTo((1 / 3) * 100, 5);
    expect(result.componentScores.channel).toBeCloseTo((1 / 3) * 100, 5);
    expect(result.competitiveOverlap).toBeCloseTo((1 / 3) * 100, 5);
  });

  it("is unavailable (not zero) for a component with no data on either side", () => {
    const result = calculateCompetitiveOverlap(
      {
        brandProductCategories: new Set(),
        operatorProductCategories: new Set(),
        brandNonBrandedKeywordClusters: new Set(["a"]),
        operatorNonBrandedKeywordClusters: new Set(["a"]),
        brandAcquisitionChannels: new Set(["google_ads"]),
        operatorAcquisitionChannels: new Set(["app_store"]),
      },
      CONFIG
    );
    expect(result.componentScores.product).toBeNull();
    expect(result.componentScores.keyword).toBe(100);
    expect(result.componentScores.channel).toBe(0);
  });
});
