import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Unified email-confirmation / OAuth callback. Handles BOTH auth flows so it
// works whatever the Supabase email template is set to:
//   • token-hash  (?token_hash=&type=)  → verifyOtp — works cross-device (the
//     token is in the URL; no browser-stored verifier needed).
//   • PKCE        (?code=)              → exchangeCodeForSession — same-browser.
// Recommended Supabase "Confirm signup" template (cross-device):
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = createClient();

  // Token-hash flow (cross-device email confirmation).
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // PKCE flow (OAuth / magic-link / default email template).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
