import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseDomain } from "@/lib/data/competitor-tier";
import type { Json } from "@/types/database.types";

/**
 * DetectZeStack webhook handler — POST /api/webhooks/detectzestack.
 * Spec: docs/skills/data-flow-rules.md §6.
 *
 * Node runtime (needs node:crypto for HMAC + sha256). SERVICE-ROLE admin client:
 * a webhook carries NO user session, so RLS can't protect us — every write is
 * scoped in code by the competitor we resolve from the verified payload domain.
 *
 * Flow:
 *  1. Read RAW body (HMAC must be over the exact bytes, before JSON.parse).
 *  2. Verify HMAC-SHA256(rawBody, DETECTZESTACK_WEBHOOK_SECRET) vs X-Signature
 *     (timing-safe). Mismatch → log audit_logs + 401, drop.
 *  3. Replay prevention: reject payloads whose timestamp is older than ~5 min.
 *  4. Resolve competitor by normalised domain. Not found → 200 { ignored }.
 *  5. INSERT competitor_changes (change_type 'tech_stack', processed=false) and
 *     UPSERT tech_stack_cache for the current Monday's scan_week.
 *  6. Do NOT fire an alert inline — the 6-hourly between-cycle monitor drains
 *     processed=false rows. Return 200 { ok }.
 */

export const runtime = "nodejs";

// Replay window: a payload timestamp older than this is rejected.
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

/** Monday (UTC) of the week containing `date`, as a YYYY-MM-DD string. */
function mondayOfWeek(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0 = Sun … 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Best-effort client IP from forwarding headers. */
function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}

/** Timing-safe hex-signature comparison (returns false on any length/parse issue). */
function safeSignatureEqual(expectedHex: string, providedHex: string): boolean {
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(providedHex, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ---- Payload shape (defensive — DetectZeStack is an external source) ----

type DetectedTechItem = {
  name?: unknown;
  category?: unknown;
};

type DetectZeStackPayload = {
  domain?: unknown;
  timestamp?: unknown;
  source_url?: unknown;
  technologies?: unknown;
  ad_networks?: unknown;
  analytics_tools?: unknown;
  cdn_providers?: unknown;
  crm_tools?: unknown;
  payment_gateways?: unknown;
};

const asString = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

/** Coerce a value to a clean string[] (dedup, drop empties). */
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string" && item.trim().length > 0) {
      const value = item.trim();
      if (!seen.has(value)) {
        seen.add(value);
        out.push(value);
      }
    }
  }
  return out;
}

/** Normalise the payload's technologies list to [{ name, category }]. */
function normaliseTechnologies(v: unknown): { name: string; category: string }[] {
  if (!Array.isArray(v)) return [];
  const out: { name: string; category: string }[] = [];
  for (const raw of v) {
    if (typeof raw === "string" && raw.trim().length > 0) {
      out.push({ name: raw.trim(), category: "unknown" });
      continue;
    }
    if (raw && typeof raw === "object") {
      const item = raw as DetectedTechItem;
      const name = asString(item.name);
      if (!name) continue;
      out.push({ name, category: asString(item.category) ?? "unknown" });
    }
  }
  return out;
}

/** Parse the payload timestamp (ISO string or epoch ms/s) → epoch ms, or null. */
function parseTimestampMs(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    // Heuristic: seconds vs milliseconds.
    return v < 1e12 ? v * 1000 : v;
  }
  if (typeof v === "string" && v.length > 0) {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.DETECTZESTACK_WEBHOOK_SECRET;
  if (!secret) {
    // Misconfiguration, not an attacker. Don't crash; surface a 500.
    return Response.json(
      { ok: false, error: "webhook not configured" },
      { status: 500 },
    );
  }

  // 1. RAW body FIRST — HMAC is over the exact bytes, before any JSON parse.
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature") ?? "";

  // 2. Verify HMAC-SHA256.
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!signature || !safeSignatureEqual(expected, signature)) {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      action: "webhook_signature_invalid",
      resource_type: "detectzestack_webhook",
      ip_address: clientIp(req),
      metadata: { reason: "hmac_mismatch" },
    });
    return Response.json({ ok: false, error: "invalid signature" }, { status: 401 });
  }

  // Signature is valid — now safe to parse.
  let payload: DetectZeStackPayload;
  try {
    payload = JSON.parse(rawBody) as DetectZeStackPayload;
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // 3. Replay prevention — reject stale payloads.
  const tsMs = parseTimestampMs(payload.timestamp);
  if (tsMs === null || Date.now() - tsMs > REPLAY_WINDOW_MS) {
    const admin = createAdminClient();
    await admin.from("audit_logs").insert({
      action: "webhook_replay_rejected",
      resource_type: "detectzestack_webhook",
      ip_address: clientIp(req),
      metadata: {
        reason: tsMs === null ? "missing_or_invalid_timestamp" : "stale_timestamp",
      },
    });
    return Response.json({ ok: false, error: "stale payload" }, { status: 401 });
  }

  // 4. Resolve competitor by normalised domain.
  const domain = normaliseDomain(asString(payload.domain) ?? "");
  if (!domain) {
    return Response.json({ ok: false, error: "missing domain" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: competitor, error: lookupError } = await admin
    .from("competitors")
    .select("id, domain")
    .eq("domain", domain)
    .maybeSingle();

  if (lookupError) {
    return Response.json({ ok: false, error: "lookup failed" }, { status: 500 });
  }

  // Unknown domains are fine — acknowledge and ignore.
  if (!competitor) {
    return Response.json({ ok: true, ignored: true });
  }

  // ---- Build the verified, normalised tech-stack snapshot ----
  const technologies = normaliseTechnologies(payload.technologies);
  const adNetworks = asStringArray(payload.ad_networks);
  const analyticsTools = asStringArray(payload.analytics_tools);
  const cdnProviders = asStringArray(payload.cdn_providers);
  const crmTools = asStringArray(payload.crm_tools);
  const paymentGateways = asStringArray(payload.payment_gateways);

  const sourceUrl = asString(payload.source_url) ?? `https://${domain}`;
  const nowIso = new Date().toISOString();
  const scanWeek = mondayOfWeek(new Date());

  const detailObject = {
    domain,
    technologies,
    ad_networks: adNetworks,
    analytics_tools: analyticsTools,
    cdn_providers: cdnProviders,
    crm_tools: crmTools,
    payment_gateways: paymentGateways,
    webhook_timestamp: new Date(tsMs).toISOString(),
  };

  // Evidence hash — SHA-256 over the verified payload bytes.
  const evidenceHash = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const detail: Json = detailObject as unknown as Json;
  const technologiesJson: Json = technologies as unknown as Json;
  const rawResponse: Json = JSON.parse(rawBody) as Json;

  // 5a. INSERT competitor_changes — processed=false so the 6h monitor picks it up.
  const { error: changeError } = await admin.from("competitor_changes").insert({
    competitor_id: competitor.id,
    change_type: "tech_stack",
    summary: `Tech stack update detected for ${domain}`,
    detail,
    source_url: sourceUrl,
    evidence_hash: evidenceHash,
    detected_at: nowIso,
    processed: false,
  });

  if (changeError) {
    return Response.json(
      { ok: false, error: "failed to record change" },
      { status: 500 },
    );
  }

  // 5b. UPSERT tech_stack_cache for the current scan_week.
  const { error: cacheError } = await admin.from("tech_stack_cache").upsert(
    {
      competitor_id: competitor.id,
      scan_week: scanWeek,
      ad_networks: adNetworks,
      analytics_tools: analyticsTools,
      cdn_providers: cdnProviders,
      crm_tools: crmTools,
      payment_gateways: paymentGateways,
      technologies: technologiesJson,
      raw_response: rawResponse,
      scanned_at: nowIso,
    },
    { onConflict: "competitor_id,scan_week" },
  );

  if (cacheError) {
    return Response.json(
      { ok: false, error: "failed to upsert cache" },
      { status: 500 },
    );
  }

  // 6. Do NOT fire an alert inline — between-cycle monitor handles processed=false.
  return Response.json({ ok: true });
}
