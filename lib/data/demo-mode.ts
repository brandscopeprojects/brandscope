// Demo mode. When NEXT_PUBLIC_DEMO_MODE=true, the data layer returns the RiversBet
// sample dataset instead of querying Supabase, so the whole app is navigable
// populated (paired with the shared-password demo login). Client- and server-safe.
// Turn OFF for real customers — it suppresses live data.

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}
