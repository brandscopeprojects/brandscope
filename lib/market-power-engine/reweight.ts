import type { ReweightedResult, WeightedComponent } from "./types";

/**
 * General missing-component reweight — ENGINE VERSION invariant (V1.5 §8/P0-8,
 * confirmed again at V1.4->V1.5 review). For ANY weighted combination where a
 * component may be unavailable:
 *
 *   result = sum(weight_i * score_i for available i) / sum(weight_i for available i)
 *
 * Never substitute 0 or 50 for an unavailable component — exclude it and
 * reweight the remaining components proportionally. If every component is
 * unavailable, the result itself is unavailable (null).
 */
export function reweightAvailable(components: WeightedComponent[]): ReweightedResult {
  const available = components.filter((c) => c.score !== null);
  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);

  if (available.length === 0 || totalWeight === 0) {
    return { value: null, effectiveWeights: {} };
  }

  const value =
    available.reduce((sum, c) => sum + c.weight * (c.score as number), 0) / totalWeight;

  const effectiveWeights: Record<string, number> = {};
  for (const c of available) {
    effectiveWeights[c.key] = (c.weight / totalWeight) * 100;
  }

  return { value, effectiveWeights };
}
