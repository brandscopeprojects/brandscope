"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { demoSignIn } from "./actions";

// TEMPORARY DEMO ACCESS.
// Email confirmation is bypassed: enter any email + the shared access password to
// get straight in (account auto-created, pre-confirmed). New users are routed to
// onboarding to set up their brand. See app/login/actions.ts to revert.
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await demoSignIn(email, password);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    // Land in-app; the (app) layout routes to /onboarding when no brand exists yet.
    const next = params.get("next") || "/dashboard";
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm text-ink-secondary">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-chip border border-divider bg-card px-3 py-2 text-ink outline-none focus:border-cobalt"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-ink-secondary">
          Access password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-chip border border-divider bg-card px-3 py-2 text-ink outline-none focus:border-cobalt"
        />
        <p className="text-xs text-ink-faint">
          Demo access — use the shared access password to sign in.
        </p>
      </div>
      {error && <p className="text-sm text-urgent">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-chip bg-cobalt px-3 py-2 font-medium text-white shadow-sh1 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Enter Brandscope"}
      </button>
    </form>
  );
}
