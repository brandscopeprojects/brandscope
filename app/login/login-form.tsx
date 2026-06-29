"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Minimal email/password auth. Two modes:
//  - sign in  → routes to ?next or /dashboard
//  - sign up  → supabase.auth.signUp, then routes new users to /onboarding
// NOTE: whether sign-up returns an active session immediately (vs requiring email
// confirmation) depends on the Supabase Auth dashboard settings — not yet
// configured by the human. If confirmation is ON, signUp yields no session and the
// user must confirm before /onboarding loads (middleware will bounce to /login).
// Design polish is a later step; tokens are respected here.

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // If email confirmation is OFF, a session exists now → straight to onboarding.
      // If it's ON, there is no session yet; tell the user to confirm first.
      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
        return;
      }
      setNotice("Check your email to confirm your account, then sign in.");
      setMode("signin");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-chip border border-divider bg-card px-3 py-2 text-ink outline-none focus:border-cobalt"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-ink-secondary">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-chip border border-divider bg-card px-3 py-2 text-ink outline-none focus:border-cobalt"
        />
      </div>
      {error && <p className="text-sm text-urgent">{error}</p>}
      {notice && <p className="text-sm text-opportunity">{notice}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-chip bg-cobalt px-3 py-2 font-medium text-white shadow-sh1 disabled:opacity-60"
      >
        {loading
          ? mode === "signup"
            ? "Creating account…"
            : "Signing in…"
          : mode === "signup"
            ? "Create account"
            : "Sign in"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "signin" ? "signup" : "signin"));
          setError(null);
          setNotice(null);
        }}
        className="text-sm text-cobalt hover:underline"
      >
        {mode === "signin"
          ? "New to Brandscope? Create an account"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
