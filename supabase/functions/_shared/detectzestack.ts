// DetectZeStack client (mvp-module-sources.md §4). CONFIRMED endpoint:
//   GET https://detectzestack.com/analyze?url={domain}  header X-API-Key: {key}
// The api.detectzestack.com/v1/detect host in the API map is WRONG (DNS failure).
// RapidAPI alternative is supported via DETECTZESTACK_RAPIDAPI_HOST if the owner
// uses that route. Response is already structured (no LLM needed).

import { requireEnv, optionalEnv } from "./env.ts";

export type TechStackResult = {
  domain: string;
  adNetworks: string[];
  analyticsTools: string[];
  cdnProviders: string[];
  crmTools: string[];
  paymentGateways: string[];
  technologies: { name: string; category: string }[];
  raw: unknown;
};

function pickArray(obj: Record<string, unknown>, ...keys: string[]): string[] {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v.map((x) => String(x));
  }
  return [];
}

/** Analyze a single competitor domain. Throws on non-200 so caller can retry/DLQ. */
export async function analyzeDomain(domain: string): Promise<TechStackResult> {
  const rapidHost = optionalEnv("DETECTZESTACK_RAPIDAPI_HOST");
  const key = requireEnv("DETECTZESTACK_API_KEY");
  const clean = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const url = rapidHost
    ? `https://${rapidHost}/analyze?url=${encodeURIComponent(clean)}`
    : `https://detectzestack.com/analyze?url=${encodeURIComponent(clean)}`;
  const headers: Record<string, string> = rapidHost
    ? { "X-RapidAPI-Key": key, "X-RapidAPI-Host": rapidHost }
    : { "X-API-Key": key };

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`DetectZeStack ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as Record<string, unknown>;

  const tech = Array.isArray(data.technologies)
    ? (data.technologies as Record<string, unknown>[]).map((t) => ({
        name: String(t.name ?? t.technology ?? ""),
        category: String(t.category ?? "other"),
      }))
    : [];

  return {
    domain: clean,
    adNetworks: pickArray(data, "ad_networks", "adNetworks", "advertising"),
    analyticsTools: pickArray(data, "analytics", "analytics_tools", "analyticsTools"),
    cdnProviders: pickArray(data, "cdn", "cdn_providers", "cdnProviders"),
    crmTools: pickArray(data, "crm", "crm_tools", "crmTools"),
    paymentGateways: pickArray(data, "payment", "payment_gateways", "paymentGateways"),
    technologies: tech,
    raw: data,
  };
}
