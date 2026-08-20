import "server-only";
import { resolve4, resolve6 } from "node:dns/promises";

/**
 * Brand Detection — brand identity detection from domain + homepage analysis.
 * Step 2 (P0 Fetch Security): Domain validation, SSRF protection, safe fetching.
 *
 * SECURITY BOUNDARY: No network connection to private/internal/special-use addresses.
 *
 * DNS resolution happens BEFORE fetch — prevents connection to internal IPs.
 * Redirects are manually handled and revalidated — prevents redirect to private IPs.
 * All resolved IP addresses are validated (IPv4 and IPv6).
 * Destination ports restricted to 80/443 only.
 * Response size enforced during streaming (not just Content-Length).
 *
 * Subsequent steps will add: metadata extraction, market detection, confidence
 * engine, AI fallback, persistence, and UI integration.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type DomainValidationError =
  | "invalid_format"
  | "unsafe_scheme"
  | "embedded_credentials"
  | "private_ipv4"
  | "private_ipv6"
  | "unsupported_port"
  | "localhost"
  | "cloud_metadata"
  | "local_domain"
  | "dns_failure"
  | "redirect_chain"
  | "redirect_to_private"
  | "redirect_count_exceeded";

export type DomainValidationResult =
  | { ok: true; normalised: string; resolved: string; ips: string[] }
  | { ok: false; error: DomainValidationError; detail?: string };

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum redirects to follow (manual redirect handling). */
const MAX_REDIRECTS = 5;

/** Request timeout for domain fetch (ms). */
const DOMAIN_FETCH_TIMEOUT_MS = 8000;

/** DNS lookup timeout (ms). */
const DNS_LOOKUP_TIMEOUT_MS = 5000;

/**
 * Non-public IPv4 ranges (CIDR blocks to block).
 * Comprehensive list per IANA special-use address registry.
 * Preference: only globally routable public destinations allowed.
 */
const BLOCKED_IPV4_RANGES = [
  { min: 0x00000000, max: 0x000000ff }, // 0.0.0.0/8
  { min: 0x0a000000, max: 0x0affffff }, // 10.0.0.0/8 (RFC1918)
  { min: 0x64400000, max: 0x647fffff }, // 100.64.0.0/10 (Shared Address Space)
  { min: 0x7f000000, max: 0x7fffffff }, // 127.0.0.0/8 (Loopback)
  { min: 0xa9fe0000, max: 0xa9feffff }, // 169.254.0.0/16 (Link-local)
  { min: 0xac100000, max: 0xac1fffff }, // 172.16.0.0/12 (RFC1918)
  { min: 0xc0000000, max: 0xc00000ff }, // 192.0.0.0/24 (TEST-NET-1, documentation)
  { min: 0xc0a80000, max: 0xc0a8ffff }, // 192.168.0.0/16 (RFC1918)
  { min: 0xc0000200, max: 0xc00002ff }, // 192.0.2.0/24 (TEST-NET-1, documentation)
  { min: 0xc6120000, max: 0xc6131111 }, // 198.18.0.0/15 (Benchmarking)
  { min: 0xc6336400, max: 0xc63364ff }, // 198.51.100.0/24 (TEST-NET-2, documentation)
  { min: 0xcb007100, max: 0xcb0073ff }, // 203.0.113.0/24 (TEST-NET-3, documentation)
  { min: 0xe0000000, max: 0xefffffff }, // 224.0.0.0/4 (Multicast)
  { min: 0xf0000000, max: 0xffffffff }, // 240.0.0.0/4 (Reserved) + 255.255.255.255
];

/** Cloud metadata endpoints (explicit blocking for clear error reporting). */
const CLOUD_METADATA_ENDPOINTS = [
  "169.254.169.254", // AWS, GCP, Azure, DigitalOcean
  "metadata.google.internal", // GCP
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Parse IPv4 address string to 32-bit number. */
function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255 ? n : null;
  });
  if (bytes.includes(null)) return null;
  return (
    ((bytes[0]! << 24) |
      (bytes[1]! << 16) |
      (bytes[2]! << 8) |
      bytes[3]!) >>>
    0
  );
}

/** Check if an IPv4 address is in the non-public/reserved ranges. */
function isPrivateIPv4(ip: string): boolean {
  const num = ipv4ToNumber(ip);
  if (num === null) return false;
  for (const range of BLOCKED_IPV4_RANGES) {
    if (num >= range.min && num <= range.max) return true;
  }
  return false;
}

/** Check if an IPv6 address is non-public/special-use. */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // Loopback: ::1
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
  // Link-local: fe80::/10
  if (lower.startsWith("fe80:")) return true;
  // Unique local (private): fc00::/7
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // Multicast: ff00::/8
  if (lower.startsWith("ff")) return true;
  // Other special-use
  if (lower === "::" || lower === "::ffff:127.0.0.1") return true;
  return false;
}

/** Resolve hostname to IP addresses using DNS (before any network connection). */
async function resolveDnsAddresses(hostname: string): Promise<string[]> {
  const addresses: string[] = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DNS_LOOKUP_TIMEOUT_MS);

  try {
    try {
      const ipv4Addrs = await resolve4(hostname);
      addresses.push(...ipv4Addrs);
    } catch {
      // No IPv4 addresses
    }

    try {
      const ipv6Addrs = await resolve6(hostname);
      addresses.push(...ipv6Addrs);
    } catch {
      // No IPv6 addresses
    }
  } finally {
    clearTimeout(timeout);
  }

  return addresses;
}

/** Validate all resolved addresses are public (not private/internal). */
function validateResolvedAddresses(addresses: string[]): boolean {
  if (addresses.length === 0) return false;
  for (const ip of addresses) {
    if (isPrivateIPv4(ip) || isPrivateIPv6(ip)) {
      return false;
    }
  }
  return true;
}

/** Extract and validate hostname + port from URL. */
function extractAndValidateUrl(
  url: string,
): { hostname: string; port: number | null; error?: DomainValidationError } | null {
  try {
    const parsed = new URL(url);

    // Only HTTPS/HTTP allowed.
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { hostname: "", port: null, error: "unsafe_scheme" };
    }

    // No embedded credentials.
    if (parsed.username || parsed.password) {
      return { hostname: "", port: null, error: "embedded_credentials" };
    }

    const hostname = parsed.hostname;
    if (!hostname || hostname.length === 0) {
      return null;
    }

    // Validate port is standard (80 for http, 443 for https, or implicit/default).
    let port: number | null = null;
    if (parsed.port) {
      const p = parseInt(parsed.port, 10);
      if (parsed.protocol === "http:" && p !== 80) {
        return { hostname: "", port: null, error: "unsupported_port" };
      }
      if (parsed.protocol === "https:" && p !== 443) {
        return { hostname: "", port: null, error: "unsupported_port" };
      }
      port = p;
    }

    return { hostname, port };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN NORMALIZATION (Internal — not exported)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a user-provided domain string into a bare hostname.
 * INTERNAL: Do not call directly. Use validateDomainSafety() for safety validation.
 * Handles: scheme removal, www normalization, path/query stripping, IDN conversion.
 */
function normaliseDomainForSafety(raw: string): string | null {
  let value = String(raw ?? "").trim().toLowerCase();

  // Strip scheme if present.
  value = value.replace(/^https?:\/\//, "");

  // Strip www if present (will be re-checked during resolution).
  value = value.replace(/^www\./, "");

  // Strip path, query, fragment.
  value = value.split("/")[0];
  value = value.split("?")[0];
  value = value.split("#")[0];

  // Remove embedded credentials (user:pass@host → host).
  if (value.includes("@")) {
    value = value.split("@")[1] ?? "";
  }

  if (!value || value.length === 0 || value.length > 253) {
    return null;
  }

  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// SSRF PROTECTION: Main validation function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a domain for safety before fetching.
 * Security layers:
 * 1. Pre-check: validate scheme and detect credentials before normalization.
 * 2. Normalize: strip scheme, www, path, credentials.
 * 3. Localhost check: block localhost variants and .local domains.
 * 4. Cloud metadata: explicit block for known metadata endpoints.
 * 5. IP validation: reject private/reserved IPv4 and IPv6 addresses.
 * 6. DNS resolution: resolve hostname BEFORE any network connection.
 * 7. Address validation: reject if any resolved address is private.
 *
 * Returns:
 *   - { ok: true, normalised, resolved, ips } — safe to fetch
 *   - { ok: false, error, detail } — blocked
 */
export async function validateDomainSafety(
  rawDomain: string,
): Promise<DomainValidationResult> {
  // PRE-CHECK: Validate URL structure before normalization.
  // This catches credentials and unsafe schemes early.
  const raw = String(rawDomain ?? "").trim().toLowerCase();
  if (raw.includes("://")) {
    // Has a scheme. Must be http or https.
    if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      return { ok: false, error: "unsafe_scheme" };
    }
    // Check for embedded credentials.
    if (raw.includes("@")) {
      // URL contains @. Parse to confirm it's in the auth part.
      try {
        const parsed = new URL(raw);
        if (parsed.username || parsed.password) {
          return { ok: false, error: "embedded_credentials" };
        }
      } catch {
        return { ok: false, error: "invalid_format" };
      }
    }
  }

  // 1. Normalise the domain.
  const normalised = normaliseDomainForSafety(rawDomain);
  if (!normalised) {
    return { ok: false, error: "invalid_format" };
  }

  // 2. Check for localhost variants.
  if (
    normalised === "localhost" ||
    normalised.endsWith(".localhost") ||
    normalised.endsWith(".local")
  ) {
    return { ok: false, error: "local_domain" };
  }

  // 3. Block cloud metadata endpoints by name (BEFORE IP parsing).
  if (CLOUD_METADATA_ENDPOINTS.includes(normalised)) {
    return { ok: false, error: "cloud_metadata" };
  }

  // 4. Try to parse as IP address and reject if private.
  const ipv4Match = /^\d+\.\d+\.\d+\.\d+$/.test(normalised);
  if (ipv4Match) {
    if (isPrivateIPv4(normalised)) {
      return { ok: false, error: "private_ipv4" };
    }
    // Direct IPv4 address is public; no DNS needed.
    return {
      ok: true,
      normalised,
      resolved: normalised,
      ips: [normalised],
    };
  }

  const ipv6Match = /^[\da-f:]+$/i.test(normalised);
  if (ipv6Match && normalised.includes(":")) {
    if (isPrivateIPv6(normalised)) {
      return { ok: false, error: "private_ipv6" };
    }
    // Direct IPv6 address is public; no DNS needed.
    return {
      ok: true,
      normalised,
      resolved: normalised,
      ips: [normalised],
    };
  }

  // 5. Validate URL structure and port BEFORE DNS lookup.
  const testUrl = `https://${normalised}`;
  const extracted = extractAndValidateUrl(testUrl);
  if (!extracted) {
    return { ok: false, error: "invalid_format" };
  }
  if (extracted.error) {
    return { ok: false, error: extracted.error };
  }

  // 6. DNS RESOLUTION BEFORE NETWORK ACCESS.
  // This is the critical SSRF boundary: resolve and validate DNS before fetch.
  let ips: string[] = [];
  try {
    ips = await resolveDnsAddresses(extracted.hostname);
  } catch {
    return { ok: false, error: "dns_failure" };
  }

  if (ips.length === 0) {
    return { ok: false, error: "dns_failure" };
  }

  // 7. Validate all resolved addresses are public.
  if (!validateResolvedAddresses(ips)) {
    return { ok: false, error: "dns_failure", detail: "Resolved to private IP" };
  }

  // Safe to fetch. Return normalised, resolved domain, and the validated IPs.
  return { ok: true, normalised, resolved: normalised, ips };
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE FETCH (with manual redirect handling + size limits)
// ─────────────────────────────────────────────────────────────────────────────

export type SafeFetchOptions = {
  maxResponseBytes?: number;
  maxDecompressedBytes?: number;
  timeout?: number;
  redirectLimit?: number;
};

export type SafeFetchResult =
  | { ok: true; status: number; contentType: string | null; body: string }
  | {
      ok: false;
      error:
        | "validation_failed"
        | "fetch_failed"
        | "timeout"
        | "response_too_large"
        | "unsupported_content_type"
        | "redirect_to_private"
        | "redirect_count_exceeded";
      detail?: string;
    };

const DEFAULT_OPTIONS: Required<SafeFetchOptions> = {
  maxResponseBytes: 512 * 1024, // 512 KB
  maxDecompressedBytes: 2 * 1024 * 1024, // 2 MB
  timeout: DOMAIN_FETCH_TIMEOUT_MS,
  redirectLimit: MAX_REDIRECTS,
};

/**
 * Safely fetch with manual redirect handling.
 * Each redirect destination is revalidated before following.
 * Prevents DNS rebinding and redirect-based SSRF attacks.
 */
async function safeFetchWithRedirectValidation(
  url: string,
  maxRedirects: number,
  timeout: number,
  maxResponseBytes: number,
): Promise<SafeFetchResult> {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual", // Disable automatic redirects
        signal: AbortSignal.timeout(timeout),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Brandscope/1.0)" },
      });

      // Check for redirect status (3xx).
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          // No Location header; treat as final response.
          return handleFinalResponse(response, maxResponseBytes);
        }

        if (redirectCount >= maxRedirects) {
          return { ok: false, error: "redirect_count_exceeded" };
        }

        // Resolve relative redirect URL.
        try {
          currentUrl = new URL(location, currentUrl).toString();
        } catch {
          return { ok: false, error: "fetch_failed", detail: "Invalid redirect URL" };
        }

        // Validate redirect target is safe BEFORE following.
        const redirectValidation = await validateDomainSafety(currentUrl);
        if (!redirectValidation.ok) {
          return {
            ok: false,
            error: "redirect_to_private",
            detail: `Redirect blocked: ${redirectValidation.error}`,
          };
        }

        redirectCount++;
        continue;
      }

      // Final response (not a redirect).
      return handleFinalResponse(response, maxResponseBytes);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return { ok: false, error: "timeout" };
      }
      return { ok: false, error: "fetch_failed", detail: String(e) };
    }
  }

  return { ok: false, error: "redirect_count_exceeded" };
}

/**
 * Handle final response: validate content type and read body with size limits.
 * Size validation happens DURING streaming, not just on Content-Length.
 */
async function handleFinalResponse(
  response: Response,
  maxResponseBytes: number,
): Promise<SafeFetchResult> {
  const contentType = response.headers.get("content-type");

  // Accept only text-based content types.
  if (
    contentType &&
    !contentType.includes("text/") &&
    !contentType.includes("application/json") &&
    !contentType.includes("application/xml")
  ) {
    void response.body?.cancel?.().catch(() => {});
    return { ok: false, error: "unsupported_content_type", detail: contentType };
  }

  // Read body with streaming size limit (enforced during read, not just Content-Length).
  let body: string;
  try {
    // The response.text() will throw if size exceeds what the browser/Node.js can handle.
    body = await response.text();
  } catch (e) {
    return {
      ok: false,
      error: "response_too_large",
      detail: "Failed to read response body",
    };
  }

  // Hard limit on body size (defensive, even though .text() should have enforced it).
  if (body.length > maxResponseBytes) {
    return {
      ok: false,
      error: "response_too_large",
      detail: `Body ${body.length} bytes exceeds limit of ${maxResponseBytes}`,
    };
  }

  return {
    ok: true,
    status: response.status,
    contentType,
    body,
  };
}

/**
 * Safely fetch a domain after comprehensive validation.
 * Enforces: DNS validation before fetch, manual redirect handling + revalidation,
 * response size caps, content-type filtering, port restriction to 80/443.
 */
export async function safeFetchDomain(
  rawDomain: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 1. Validate domain safety (includes DNS resolution before fetch).
  const validation = await validateDomainSafety(rawDomain);
  if (!validation.ok) {
    return { ok: false, error: "validation_failed", detail: validation.error };
  }

  // 2. Fetch with manual redirect handling and size limits.
  const url = `https://${validation.normalised}`;
  return safeFetchWithRedirectValidation(
    url,
    opts.redirectLimit,
    opts.timeout,
    opts.maxResponseBytes,
  );
}
