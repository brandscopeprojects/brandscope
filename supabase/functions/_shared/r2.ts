// Cloudflare R2 client for Edge Functions (S3-compatible, via aws4fetch signing).
// Credentials live in Supabase Edge Function secrets (docs/env-vars.md):
// CLOUDFLARE_R2_ACCOUNT_ID / _ACCESS_KEY_ID / _SECRET_ACCESS_KEY / _BUCKET_NAME.
// The endpoint is derived from the account id: <id>.r2.cloudflarestorage.com.

import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";
import { requireEnv } from "./env.ts";

function r2() {
  const accountId = requireEnv("CLOUDFLARE_R2_ACCOUNT_ID");
  const client = new AwsClient({
    accessKeyId: requireEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    region: "auto",
    service: "s3",
  });
  return { client, base: `https://${accountId}.r2.cloudflarestorage.com/${requireEnv("CLOUDFLARE_R2_BUCKET_NAME")}` };
}

/** Upload an object. Throws on non-2xx. */
export async function r2Put(
  key: string,
  body: Uint8Array | ArrayBuffer,
  contentType = "application/octet-stream",
): Promise<void> {
  const { client, base } = r2();
  const res = await client.fetch(`${base}/${key}`, {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType },
  });
  const ok = res.ok;
  const errText = ok ? "" : (await res.text()).slice(0, 300);
  void res.body?.cancel?.().catch(() => {});
  if (!ok) throw new Error(`R2 PUT ${key} failed: ${errText}`);
}

/** Download an object as bytes. Throws on non-2xx. */
export async function r2Get(key: string): Promise<Uint8Array> {
  const { client, base } = r2();
  const res = await client.fetch(`${base}/${key}`, { method: "GET" });
  if (!res.ok) {
    const t = (await res.text()).slice(0, 300);
    throw new Error(`R2 GET ${key} failed (${res.status}): ${t}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
