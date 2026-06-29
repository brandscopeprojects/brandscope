"use server";

// TEMPORARY DEMO ACCESS BYPASS.
// Skips email confirmation so the app is reachable with a single shared password.
// Any email + the demo password signs in; the account is auto-created (email
// pre-confirmed) and a brand is set up via the normal onboarding flow afterwards.
// Keeps the real Supabase session + RLS model intact (no faked sessions).
//
// To REVERT: delete this file + app/login/actions.ts usage in login-form.tsx and
// restore the email/password signUp flow. Gate password can be overridden with
// the DEMO_ACCESS_PASSWORD env var.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEMO_PASSWORD = process.env.DEMO_ACCESS_PASSWORD || "brandscope2026";

export type DemoSignInResult = { ok: true } | { ok: false; error: string };

export async function demoSignIn(email: string, password: string): Promise<DemoSignInResult> {
  if (password !== DEMO_PASSWORD) {
    return { ok: false, error: "Incorrect access password." };
  }
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = createClient();

  // 1. Try to sign in (existing demo account → session cookie set here).
  const first = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: DEMO_PASSWORD,
  });
  if (!first.error) return { ok: true };

  // 2. No account (or stale password) → create a pre-confirmed user with the
  //    demo password (service role), then retry sign-in.
  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });

  if (created.error && !/already|registered|exists/i.test(created.error.message)) {
    return { ok: false, error: created.error.message };
  }

  // 2b. Existed with a different password → force it to the demo password.
  if (created.error) {
    const { data: list } = await admin.auth.admin.listUsers();
    const user = list?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
    if (user) {
      await admin.auth.admin.updateUserById(user.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
    }
  }

  const retry = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: DEMO_PASSWORD,
  });
  if (retry.error) return { ok: false, error: retry.error.message };
  return { ok: true };
}
