import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Token-hash email confirmation (cross-device). Unlike the PKCE /auth/callback
// route, verifyOtp only needs the token_hash from the URL — no code-verifier
// stored in the originating browser — so the confirmation link works even when
// opened on a different device than the one used to sign up.
//
// Requires the Supabase "Confirm signup" email template to link here, e.g.:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/onboarding
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // Session cookie is set by the server client → land the user in-app.
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
