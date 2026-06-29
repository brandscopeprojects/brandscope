import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import type { StatusTone } from "@/components/intelligence/StatusPill";

/**
 * Internal-admin Security Centre data (Screen 28, /brandscope-admin/security).
 *
 * SUPER-ADMIN ONLY. The four source tables — `active_sessions`, `failed_logins`,
 * `audit_logs`, `rbac_config` — are ALL Class-2 (service-role-only) and their
 * data is GLOBAL, not brand-scoped (rls-policies.md). We read them with the
 * ADMIN client (createAdminClient), which bypasses RLS, AFTER re-checking the
 * caller is a super_admin here (defense-in-depth; the page also gates).
 *
 * Every value returned is REAL — pulled straight from the tables. When a table
 * has no rows we return an empty array; the page renders an honest empty state
 * rather than fabricating telemetry. Returns null if the caller is not a
 * super_admin.
 */

// ── Formatting helpers (server-side, evidence style) ─────────────────────────

/** ISO timestamp → "23 Jun 2026, 14:05 UTC" (mono evidence value). Null-safe. */
function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${date}, ${time} UTC`;
}

/** Postgres inet/cidr comes through the typed client as `unknown`. Coerce safely. */
function formatIp(ip: unknown): string {
  if (ip == null) return "—";
  const s = String(ip).trim();
  return s.length > 0 ? s : "—";
}

/** Title-case a role/status string, dropping underscores. */
function humanise(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Compact a possibly-long user-agent into a readable device label. */
function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const s = ua.trim();
  if (s.length === 0) return "Unknown device";
  // Best-effort OS / browser extraction without pulling in a UA parser.
  const os =
    /Windows/i.test(s)
      ? "Windows"
      : /Mac OS X|Macintosh/i.test(s)
        ? "macOS"
        : /Android/i.test(s)
          ? "Android"
          : /iPhone|iPad|iOS/i.test(s)
            ? "iOS"
            : /Linux/i.test(s)
              ? "Linux"
              : null;
  const browser =
    /Edg\//i.test(s)
      ? "Edge"
      : /Chrome\//i.test(s)
        ? "Chrome"
        : /Firefox\//i.test(s)
          ? "Firefox"
          : /Safari\//i.test(s)
            ? "Safari"
            : null;
  if (os && browser) return `${browser} · ${os}`;
  if (os) return os;
  if (browser) return browser;
  // Fall back to a trimmed raw string.
  return s.length > 48 ? `${s.slice(0, 45)}…` : s;
}

// ── View models ──────────────────────────────────────────────────────────────

export type SessionVM = {
  id: string;
  user: string;
  email: string | null;
  role: string;
  ip: string;
  device: string;
  location: string | null;
  lastActive: string;
  statusLabel: string;
  statusTone: StatusTone;
};

export type FailedLoginVM = {
  id: string;
  email: string;
  ip: string;
  location: string | null;
  attempts: string;
  reason: string;
  statusLabel: string;
  /** urgent (blocked) or watch (suspicious/failed) — never green for a security-negative. */
  statusTone: Extract<StatusTone, "bad" | "warn">;
  lastAttempt: string;
};

export type AuditLogVM = {
  id: string;
  actor: string;
  action: string;
  target: string;
  ip: string;
  time: string;
};

export type RbacMatrixVM = {
  roles: string[];
  permissions: string[];
  /** allowed[role][permission] = true/false. */
  allowed: Record<string, Record<string, boolean>>;
};

export type SecurityStatsVM = {
  activeSessions: number;
  failedLogins24h: number;
  openAlerts: number;
};

export type InternalSecurityData = {
  stats: SecurityStatsVM;
  sessions: SessionVM[];
  failedLogins: FailedLoginVM[];
  rbac: RbacMatrixVM | null;
  auditLog: AuditLogVM[];
};

// ── Status mapping ───────────────────────────────────────────────────────────

/** A failed-login row's status → tone. Blocked = urgent (bad), anything else = watch. */
function failedLoginTone(status: string | null | undefined): Extract<StatusTone, "bad" | "warn"> {
  return (status ?? "").toLowerCase() === "blocked" ? "bad" : "warn";
}

/** A session row's active flag → pill tone/label. Active = good, ended = neutral. */
function sessionStatus(isActive: boolean | null): { label: string; tone: StatusTone } {
  return isActive
    ? { label: "Active", tone: "good" }
    : { label: "Ended", tone: "neutral" };
}

// ── Fetcher ──────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Load the global Security Centre snapshot. Super-admin only — returns null for
 * any other role. Returns typed view models with empty arrays where a table has
 * no rows. Never throws on missing data; the page decides between the empty
 * state and the populated tables.
 */
export async function getInternalSecurity(): Promise<InternalSecurityData | null> {
  // Defense-in-depth: the page gates super_admin, we re-check here too.
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") return null;

  const supabase = createAdminClient();

  const [sessionRes, failedRes, auditRes, rbacRes] = await Promise.all([
    // Current sessions — active first, then most-recently-seen.
    supabase
      .from("active_sessions")
      .select(
        "id, profile_id, role, ip_address, user_agent, location, is_active, last_activity_at, login_at",
      )
      .order("is_active", { ascending: false, nullsFirst: false })
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(50),
    // Recent failed logins, latest first.
    supabase
      .from("failed_logins")
      .select(
        "id, attempted_email, ip_address, location, reason, status, attempted_at, created_at",
      )
      .order("attempted_at", { ascending: false, nullsFirst: false })
      .limit(30),
    // Recent privileged actions, latest first.
    supabase
      .from("audit_logs")
      .select(
        "id, profile_id, action, resource_type, resource_id, ip_address, created_at",
      )
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(40),
    // Full role → permission matrix.
    supabase
      .from("rbac_config")
      .select("id, role, permission_key, allowed")
      .order("role", { ascending: true })
      .order("permission_key", { ascending: true }),
  ]);

  // ── Resolve actor/user identities (profiles is Class-2; same admin client) ──
  const profileIds = new Set<string>();
  for (const row of sessionRes.data ?? []) if (row.profile_id) profileIds.add(row.profile_id);
  for (const row of auditRes.data ?? []) if (row.profile_id) profileIds.add(row.profile_id);

  const identities = new Map<string, { name: string; email: string }>();
  if (profileIds.size > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", Array.from(profileIds));
    for (const p of profileRows ?? []) {
      identities.set(p.id, { name: p.full_name ?? p.email, email: p.email });
    }
  }

  // ── active_sessions → session rows ──
  const sessions: SessionVM[] = (sessionRes.data ?? []).map((row) => {
    const identity = identities.get(row.profile_id);
    const status = sessionStatus(row.is_active);
    return {
      id: row.id,
      user: identity?.name ?? "Unknown user",
      email: identity?.email ?? null,
      role: humanise(row.role),
      ip: formatIp(row.ip_address),
      device: deviceLabel(row.user_agent),
      location: row.location,
      lastActive: formatTimestamp(row.last_activity_at ?? row.login_at),
      statusLabel: status.label,
      statusTone: status.tone,
    };
  });

  // ── failed_logins → failed-login rows (group by email+ip to show attempts) ──
  type FailedRow = NonNullable<typeof failedRes.data>[number];
  const failedRows: FailedRow[] = failedRes.data ?? [];
  const failedLogins: FailedLoginVM[] = failedRows.map((row) => {
    // attempts: count rows that share this email+ip within the window (≥1).
    const email = row.attempted_email ?? "—";
    const ip = formatIp(row.ip_address);
    const attempts = failedRows.filter(
      (r) => (r.attempted_email ?? "—") === email && formatIp(r.ip_address) === ip,
    ).length;
    return {
      id: row.id,
      email,
      ip,
      location: row.location,
      attempts: String(attempts),
      reason: humanise(row.reason),
      statusLabel: humanise(row.status),
      statusTone: failedLoginTone(row.status),
      lastAttempt: formatTimestamp(row.attempted_at ?? row.created_at),
    };
  });

  // ── audit_logs → audit rows ──
  const auditLog: AuditLogVM[] = (auditRes.data ?? []).map((row) => {
    const identity = row.profile_id ? identities.get(row.profile_id) : undefined;
    const target =
      row.resource_type && row.resource_id
        ? `${humanise(row.resource_type)} · ${row.resource_id}`
        : row.resource_type
          ? humanise(row.resource_type)
          : "—";
    return {
      id: row.id,
      actor: identity?.name ?? identity?.email ?? "System",
      action: row.action,
      target,
      ip: formatIp(row.ip_address),
      time: formatTimestamp(row.created_at),
    };
  });

  // ── rbac_config → role × permission matrix ──
  const rbacRows = rbacRes.data ?? [];
  let rbac: RbacMatrixVM | null = null;
  if (rbacRows.length > 0) {
    const roles = Array.from(new Set(rbacRows.map((r) => r.role))).sort();
    const permissions = Array.from(new Set(rbacRows.map((r) => r.permission_key))).sort();
    const allowed: Record<string, Record<string, boolean>> = {};
    for (const role of roles) allowed[role] = {};
    for (const r of rbacRows) {
      (allowed[r.role] ??= {})[r.permission_key] = r.allowed;
    }
    rbac = { roles, permissions, allowed };
  }

  // ── Stats (all real counts) ──
  const now = Date.now();
  const failedLogins24h = failedRows.filter((r) => {
    const ts = r.attempted_at ?? r.created_at;
    if (!ts) return false;
    const t = new Date(ts).getTime();
    return !Number.isNaN(t) && now - t <= DAY_MS;
  }).length;
  // "Open alerts" = security-negative login events that were blocked (urgent).
  const openAlerts = failedRows.filter(
    (r) => (r.status ?? "").toLowerCase() === "blocked",
  ).length;

  const stats: SecurityStatsVM = {
    activeSessions: sessions.filter((s) => s.statusTone === "good").length,
    failedLogins24h,
    openAlerts,
  };

  return { stats, sessions, failedLogins, rbac, auditLog };
}
