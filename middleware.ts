import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { updateSession } from "@/lib/supabase/middleware";
import type { Database } from "@/types/database.types";

// Route protection (data-flow-rules: brand reads SSR + RLS; admin areas role-gated).
const PUBLIC_PREFIXES = ["/login", "/auth", "/unauthorized", "/preview"];
const INTERNAL_ADMIN_PREFIX = "/brandscope-admin";
const BRAND_ADMIN_PREFIX = "/admin";

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// profiles is service-role-only (RLS enabled, no policy) — the user's own client
// cannot read it, so role lookup uses the service role. Only runs for admin areas.
async function getUserRole(userId: string): Promise<string | null> {
  const admin = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data } = await admin.from("profiles").select("role").eq("id", userId).single();
  return data?.role ?? null;
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return response;

  // Every non-public app route requires a signed-in user.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Role-gated areas.
  const inInternal = pathname.startsWith(INTERNAL_ADMIN_PREFIX);
  const inBrandAdmin = pathname.startsWith(BRAND_ADMIN_PREFIX);
  if (inInternal || inBrandAdmin) {
    const role = (await getUserRole(user.id)) ?? "";
    if (inInternal && !["internal_admin", "super_admin"].includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    if (inBrandAdmin && !["brand_admin", "super_admin"].includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  return response;
}

export const config = {
  // Run on all routes except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
