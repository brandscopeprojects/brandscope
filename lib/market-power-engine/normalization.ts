import type { Direction } from "./types";

/**
 * Midrank percentile — ENGINE VERSION invariant (V1.5 §1/P0-1). Changing this
 * formula requires a new engine version + golden benchmark, not a config edit.
 *
 * Properties: highest unique value -> 100, lowest unique value -> 0, tied
 * values share an identical midrank, N < 2 is undefined (caller must gate on
 * minimumOperatorsForUniverse before calling).
 */
export function midrankPercentile(value: number, universe: number[]): number {
  if (universe.length < 2) {
    throw new Error("midrankPercentile requires at least 2 operators in the universe");
  }
  const countBelow = universe.filter((v) => v < value).length;
  const countEqual = universe.filter((v) => v === value).length;
  return ((countBelow + (countEqual - 1) / 2) / (universe.length - 1)) * 100;
}

/**
 * Robust magnitude via median/MAD + tanh compression — ENGINE VERSION
 * invariant (V1.5 §2/P0-2). Preserves the distance between operators that
 * pure percentile rank erases (e.g. [100,99,98,97] vs [100,30,20,10]).
 */
export function robustMagnitude(
  value: number,
  universe: number[],
  direction: Direction,
  fallbackSpread: number
): number {
  const sorted = [...universe].sort((a, b) => a - b);
  const median = medianOf(sorted);
  const mad = medianAbsoluteDeviation(sorted, median);
  const spread = Math.max(1.4826 * mad, fallbackSpread);

  const signedDelta = direction === "higher_is_better" ? value - median : median - value;
  const robustZ = spread === 0 ? 0 : signedDelta / spread;
  return 50 + 50 * Math.tanh(robustZ / 2);
}

/**
 * metric_score = alpha * percentile + (1 - alpha) * magnitude — ENGINE
 * VERSION invariant. alpha itself is DB config (percentileMagnitudeAlpha).
 */
export function combinePercentileAndMagnitude(
  percentileComponent: number,
  magnitudeComponent: number,
  alpha: number
): number {
  return alpha * percentileComponent + (1 - alpha) * magnitudeComponent;
}

function medianOf(sortedValues: number[]): number {
  const n = sortedValues.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 : sortedValues[mid];
}

function medianAbsoluteDeviation(sortedValues: number[], median: number): number {
  const deviations = sortedValues.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  return medianOf(deviations);
}
