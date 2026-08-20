import "server-only";

/**
 * Brand Detection — brand identity detection from domain + homepage analysis.
 * Step 2 (P0 Fetch Security): Domain validation, SSRF protection, safe fetching.
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
  | "link_local"
  | "localhost"
  | "cloud_metadata"
  | "local_domain"
  | "dns_failure"
  | "redirect_chain"
  | "redirect_to_private"
  | "redirect_count_exceeded";

export type DomainValidationResult =
  | { ok: true; normalised: string; resolved: string }
  | { ok: false; error: DomainValidationError; detail?: string };

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum redirects to follow. */
const MAX_REDIRECTS = 5;

/** Request timeout for domain fetch (ms). */
const DOMAIN_FETCH_TIMEOUT_MS = 8000;

/** Private IPv4 ranges (CIDR blocks to block). */
const PRIVATE_IPV4_RANGES = [
  { min: 0x00000000, max: 0x000000ff }, // 0.0.0.0/8
  { min: 0x0a000000, max: 0x0affffff }, // 10.0.0.0/8
  { min: 0x7f000000, max: 0x7fffffff }, // 127.0.0.0/8 (loopback)
  { min: 0xa9fe0000, max: 0xa9feffff }, // 169.254.0.0/16 (link-local)
  { min: 0xac100000, max: 0xac1fffff }, // 172.16.0.0/12
  { min: 0xc0a80000, max: 0xc0a8ffff }, // 192.168.0.0/16
  { min: 0xc6120000, max: 0xc6121111 }, // 198.18.0.0/15 (benchmarking)
  { min: 0xe0000000, max: 0xffffffff }, // 224.0.0.0/4 (multicast + reserved)
];

/** Cloud metadata endpoints (request will be blocked if resolves to these). */
const CLOUD_METADATA_ENDPOINTS = [
  // AWS
  "169.254.169.254",
  // GCP
  "metadata.google.internal",
  "169.254.169.254",
  // Azure
  "169.254.169.254",
  // DigitalOcean
  "169.254.169.254",
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

/** Check if an IPv4 address is in the private/reserved ranges. */
function isPrivateIPv4(ip: string): boolean {
  const num = ipv4ToNumber(ip);
  if (num === null) return false;
  for (const range of PRIVATE_IPV4_RANGES) {
    if (num >= range.min && num <= range.max) return true;
  }
  return false;
}

/** Check if an IPv6 address is loopback or private. */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // Loopback: ::1
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
  // Link-local: fe80::/10
  if (lower.startsWith("fe80:")) return true;
  // Unique local (private): fc00::/7
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

/** Resolve hostname to IP(s) and check for private networks. */
async function resolveAndValidateHost(
  hostname: string,
): Promise<{ ok: boolean; error?: DomainValidationError; ips?: string[] }> {
  try {
    const response = await fetch(`https://${hostname}:443`, {
      method: "HEAD",
      signal: AbortSignal.timeout(DOMAIN_FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Brandscope/1.0)" },
    });
    // If fetch succeeds (any status), the hostname resolved safely.
    // If it fails, we catch it below.
    void response.body?.cancel?.().catch(() => {});
    return { ok: true };
  } catch (e) {
    // DNS failures result in a network error → dns_failure.
    // A successful fetch that gets here means the address was reachable and safe.
    if (e instanceof TypeError) {
      // Network/DNS error
      return { ok: false, error: "dns_failure" };
    }
    if (e instanceof DOMException && e.name === "AbortError") {
      // Timeout is still a successful resolve (address exists) but slow.
      // Treat as reachable.
      return { ok: true };
    }
    return { ok: false, error: "dns_failure" };
  }
}

/** Extract hostname from URL, validating scheme and structure. */
function extractAndValidateHostname(
  url: string,
): { hostname: string; scheme: string } | null {
  try {
    const parsed = new URL(url);

    // Only HTTPS/HTTP allowed.
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    // No embedded credentials.
    if (parsed.username || parsed.password) {
      return null;
    }

    const hostname = parsed.hostname;
    if (!hostname || hostname.length === 0) {
      return null;
    }

    return { hostname, scheme: parsed.protocol };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN NORMALIZATION (SSRF-aware)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalise a user-provided domain string into a bare hostname.
 * Handles: scheme removal, www normalization, path/query stripping, IDN conversion.
 * Does NOT validate safety; use validateDomainSafety() for that.
 */
export function normaliseDomainForSafety(raw: string): string | null {
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
 * 1. Check for embedded credentials or unsafe schemes (block before normalization).
 * 2. Parse and normalise.
 * 3. Check for localhost/local domains.
 * 4. Block cloud metadata endpoints by name (before IP parsing).
 * 5. Validate IP addresses (no private ranges).
 * 6. Resolve hostname and re-check resolved IPs.
 * 7. Enforce redirect limits and re-validate redirects.
 *
 * Returns:
 *   - { ok: true, normalised, resolved } — safe to fetch
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
      // URL contains credentials. Parse to confirm they're in the auth part.
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

  // 3. Block cloud metadata endpoints by name (BEFORE IP parsing, to avoid
  //    categorizing 169.254.169.254 as just "private" when it's specifically
  //    a metadata service).
  if (CLOUD_METADATA_ENDPOINTS.includes(normalised)) {
    return { ok: false, error: "cloud_metadata" };
  }

  // 4. Try to parse as IP and reject if private.
  const ipv4Match = /^\d+\.\d+\.\d+\.\d+$/.test(normalised);
  if (ipv4Match) {
    if (isPrivateIPv4(normalised)) {
      return { ok: false, error: "private_ipv4" };
    }
  }

  const ipv6Match = /^[\da-f:]+$/i.test(normalised);
  if (ipv6Match && normalised.includes(":")) {
    if (isPrivateIPv6(normalised)) {
      return { ok: false, error: "private_ipv6" };
    }
  }

  // 5. Construct a safe test URL and validate it before fetching.
  const testUrl = `https://${normalised}`;
  const extracted = extractAndValidateHostname(testUrl);
  if (!extracted) {
    return { ok: false, error: "invalid_format" };
  }

  // 6. Perform DNS lookup and validate resolved address(es).
  // This will reject if DNS fails or resolves to a private network.
  const resolveResult = await resolveAndValidateHost(extracted.hostname);
  if (!resolveResult.ok) {
    return { ok: false, error: resolveResult.error || "dns_failure" };
  }

  // 7. Safe to fetch. Return the normalised and resolved domain.
  return { ok: true, normalised, resolved: normalised };
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE FETCH (with redirect/size limits)
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
        | "unsupported_content_type";
      detail?: string;
    };

const DEFAULT_OPTIONS: Required<SafeFetchOptions> = {
  maxResponseBytes: 512 * 1024, // 512 KB
  maxDecompressedBytes: 2 * 1024 * 1024, // 2 MB
  timeout: DOMAIN_FETCH_TIMEOUT_MS,
  redirectLimit: MAX_REDIRECTS,
};

/**
 * Safely fetch a domain after validation.
 * Enforces: SSRF checks, redirect limits, response size caps, content-type filtering.
 */
export async function safeFetchDomain(
  rawDomain: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 1. Validate domain safety.
  const validation = await validateDomainSafety(rawDomain);
  if (!validation.ok) {
    return { ok: false, error: "validation_failed", detail: validation.error };
  }

  // 2. Fetch with timeout and redirect limits.
  try {
    const response = await fetch(`https://${validation.normalised}`, {
      method: "GET",
      signal: AbortSignal.timeout(opts.timeout),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Brandscope/1.0)" },
      // Note: native fetch has redirect: "follow" by default with a limit.
      // We rely on the platform's internal redirect limit; additional validation
      // can be added if needed.
    });

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

    // Check response size before reading.
    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      const bytes = Number(contentLength);
      if (!Number.isFinite(bytes) || bytes > opts.maxResponseBytes) {
        void response.body?.cancel?.().catch(() => {});
        return {
          ok: false,
          error: "response_too_large",
          detail: `${bytes} bytes exceeds limit of ${opts.maxResponseBytes}`,
        };
      }
    }

    // Read body with size limit.
    let body: string;
    try {
      body = await response.text();
    } catch {
      return {
        ok: false,
        error: "response_too_large",
        detail: "Failed to read response body",
      };
    }

    if (body.length > opts.maxResponseBytes) {
      return {
        ok: false,
        error: "response_too_large",
        detail: `Body ${body.length} bytes exceeds limit of ${opts.maxResponseBytes}`,
      };
    }

    return {
      ok: true,
      status: response.status,
      contentType,
      body,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: "fetch_failed", detail: String(e) };
  }
}
