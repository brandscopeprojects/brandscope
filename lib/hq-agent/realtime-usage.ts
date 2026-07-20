import "server-only";

// Realtime voice-session usage tracking (for §15 rate limiting + telemetry).
// We reuse hq_tool_runs with a sentinel tool_name so no extra table is needed;
// existing billing/analytics can read these rows later.

import type { Admin } from "./types";

const SESSION_MARKER = "__realtime_session__";

export async function logRealtimeSession(admin: Admin, profileId: string): Promise<void> {
  try {
    await admin.from("hq_tool_runs").insert({
      profile_id: profileId,
      tool_name: SESSION_MARKER,
      modality: "voice",
      success: true,
    });
  } catch {
    /* best-effort telemetry */
  }
}

/** Count a user's realtime session mints in the last windowSec seconds. */
export async function recentRealtimeSessions(admin: Admin, profileId: string, windowSec: number): Promise<number> {
  const since = new Date(Date.now() - windowSec * 1000).toISOString();
  const { count } = await admin
    .from("hq_tool_runs")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("tool_name", SESSION_MARKER)
    .gte("created_at", since);
  return count ?? 0;
}
