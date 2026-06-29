import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProfileRole =
  | "super_admin"
  | "internal_admin"
  | "brand_admin"
  | "brand_editor"
  | "brand_viewer";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
};

/** The signed-in auth user (or null). Validated against Supabase Auth, not just cookies. */
export async function getSessionUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The current user's profile row. Uses the service role (profiles is service-role-only). */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();
  return (data as Profile) ?? null;
}

/** Use in a protected layout/page: redirect to /login if not signed in. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Brand Admin area guard (/admin/*). */
export async function requireBrandAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!["brand_admin", "super_admin"].includes(profile.role)) redirect("/unauthorized");
  return profile;
}

/** Internal Admin area guard (/brandscope-admin/*). */
export async function requireInternalAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!["internal_admin", "super_admin"].includes(profile.role)) redirect("/unauthorized");
  return profile;
}
