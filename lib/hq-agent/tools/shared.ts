import "server-only";

// Shared helpers for HQ tools: strict input validation, bounded date ranges, and
// small aggregation utilities. Every tool validates its own input server-side —
// the model's arguments are never trusted directly.

export const PERIODS = ["today", "last_7_days", "last_30_days", "last_90_days", "this_week"] as const;
export type Period = (typeof PERIODS)[number];

export type ResolvedPeriod = { sinceIso: string; label: string; days: number };

/** Resolve a period enum into a bounded UTC start timestamp. Unknown → 30 days. */
export function resolvePeriod(raw: unknown): ResolvedPeriod {
  const p = typeof raw === "string" && (PERIODS as readonly string[]).includes(raw) ? (raw as Period) : "last_30_days";
  const now = Date.now();
  switch (p) {
    case "today": {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      return { sinceIso: d.toISOString(), label: "today (UTC)", days: 1 };
    }
    case "this_week": {
      const d = new Date();
      const day = (d.getUTCDay() + 6) % 7;
      d.setUTCDate(d.getUTCDate() - day);
      d.setUTCHours(0, 0, 0, 0);
      return { sinceIso: d.toISOString(), label: "this week (UTC, Mon-start)", days: 7 };
    }
    case "last_7_days":
      return { sinceIso: new Date(now - 7 * 864e5).toISOString(), label: "last 7 days", days: 7 };
    case "last_90_days":
      return { sinceIso: new Date(now - 90 * 864e5).toISOString(), label: "last 90 days", days: 90 };
    case "last_30_days":
    default:
      return { sinceIso: new Date(now - 30 * 864e5).toISOString(), label: "last 30 days", days: 30 };
  }
}

/** A reusable `period` parameter for a tool's JSON schema. */
export const PERIOD_PARAM = {
  period: {
    type: "string",
    enum: [...PERIODS],
    description: "Time window for the query. Defaults to last_30_days.",
  },
} as const;

/** Validate that a raw value is an object; return it (or {}). Rejects arrays/null. */
export function asObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/** Validate an optional period arg, throwing on an explicitly invalid (non-enum) string. */
export function validatePeriodArg(raw: unknown): Record<string, unknown> {
  const obj = asObject(raw);
  if (obj.period !== undefined) {
    if (typeof obj.period !== "string" || !(PERIODS as readonly string[]).includes(obj.period)) {
      throw new Error(`invalid 'period' (allowed: ${PERIODS.join(", ")})`);
    }
  }
  return { period: obj.period ?? "last_30_days" };
}

export const kobo = (v: number | null | undefined) => Math.round((v ?? 0) / 100);

export function weekOf(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function countBy<T>(rows: T[], key: (r: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[key(r)] = (out[key(r)] ?? 0) + 1;
  return out;
}

export function nowIso(): string {
  return new Date().toISOString();
}
