import type { MarketPowerScoringConfig, MomentumTrend } from "./types";

export type MomentumResult = {
  trend: MomentumTrend;
  pressureScore: number | null; // null = unavailable, exclude from Threat and reweight
};

/**
 * Momentum is a change in the shared Operator × Market Market Standing over
 * time — it lives on market_power_operator_snapshot /
 * operator_market_current_position, NOT on the brand-relative relationship
 * (V1.5 §momentum_scope_wrong).
 *
 * momentum_trend is DISPLAY ONLY ("Stable", "Declining", ...).
 * momentum_pressure_score is the THREAT input: only upward momentum
 * contributes positive pressure. Stable/downward/strong_downward contribute
 * ZERO pressure (never negative, never treated as risk-reducing "credit") —
 * they are simply absent from the Competitive Threat calculation via
 * reweight.ts, exactly like any other unavailable component.
 */
export function calculateMomentum(
  historicalStandingScores: number[], // oldest -> newest
  config: MarketPowerScoringConfig
): MomentumResult {
  if (historicalStandingScores.length < 2) {
    return { trend: "unavailable", pressureScore: null };
  }

  const deltas: number[] = [];
  for (let i = 1; i < historicalStandingScores.length; i++) {
    deltas.push(historicalStandingScores[i] - historicalStandingScores[i - 1]);
  }
  const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
  const stddev = Math.sqrt(
    deltas.reduce((sum, d) => sum + (d - avgDelta) ** 2, 0) / deltas.length
  );

  if (avgDelta >= config.momentumStrongUpwardThreshold) {
    return { trend: "strong_upward", pressureScore: config.momentumPressureStrongUpward };
  }
  if (avgDelta >= config.momentumUpwardThreshold) {
    return { trend: "upward", pressureScore: config.momentumPressureUpward };
  }
  if (avgDelta <= config.momentumStrongDownwardThreshold) {
    return { trend: "strong_downward", pressureScore: null };
  }
  if (avgDelta <= config.momentumDownwardThreshold) {
    return { trend: "downward", pressureScore: null };
  }
  if (stddev <= config.momentumStabilityStddevThreshold) {
    return { trend: "stable", pressureScore: null };
  }
  // Small average delta but high volatility: insufficient signal for a trend
  // call. Treat as unavailable rather than guessing "stable".
  return { trend: "unavailable", pressureScore: null };
}
