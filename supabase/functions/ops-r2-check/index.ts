// ops-r2-check — TEMP diagnostic. Confirms Cloudflare R2 is wired end-to-end:
// reports which R2 vars are present, then does a real S3 round-trip against the
// bucket (PUT a tiny object → GET it back → DELETE it). Self-contained;
// CRON_SECRET-gated; verify_jwt=false. Never logs secret VALUES.

import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer || bearer !== Deno.env.get("CRON_SECRET")) return json({ error: "unauthorized" }, 401);

  const accountId = Deno.env.get("CLOUDFLARE_R2_ACCOUNT_ID");
  const accessKeyId = Deno.env.get("CLOUDFLARE_R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  const bucket = Deno.env.get("CLOUDFLARE_R2_BUCKET_NAME");
  const publicUrl = Deno.env.get("CLOUDFLARE_R2_PUBLIC_URL");

  const present = {
    CLOUDFLARE_R2_ACCOUNT_ID: Boolean(accountId),
    CLOUDFLARE_R2_ACCESS_KEY_ID: Boolean(accessKeyId),
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: Boolean(secretAccessKey),
    CLOUDFLARE_R2_BUCKET_NAME: Boolean(bucket),
    CLOUDFLARE_R2_PUBLIC_URL: Boolean(publicUrl),
  };
  const missing = Object.entries(present).filter(([, v]) => !v).map(([k]) => k);
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return json({ ok: false, reason: "missing required R2 vars", present, missing }, 200);
  }

  const endpoint = `${accountId}.r2.cloudflarestorage.com`;
  const client = new AwsClient({ accessKeyId, secretAccessKey, region: "auto", service: "s3" });
  const key = `healthcheck/ping-${Date.now()}.txt`;
  const url = `https://${endpoint}/${bucket}/${key}`;
  const marker = "brandscope-r2-healthcheck";
  const steps: Record<string, unknown> = {};

  try {
    const put = await client.fetch(url, {
      method: "PUT",
      body: marker,
      headers: { "Content-Type": "text/plain" },
    });
    steps.put = { status: put.status, ok: put.ok, error: put.ok ? null : (await put.text()).slice(0, 300) };

    const get = await client.fetch(url, { method: "GET" });
    const gotBody = await get.text();
    steps.get = {
      status: get.status,
      ok: get.ok,
      body_matches: get.ok && gotBody === marker,
      error: get.ok ? null : gotBody.slice(0, 300),
    };

    const del = await client.fetch(url, { method: "DELETE" });
    steps.delete = { status: del.status, ok: del.ok };
  } catch (e) {
    steps.error = e instanceof Error ? e.message : String(e);
  }

  const s = steps as { put?: { ok?: boolean }; get?: { ok?: boolean; body_matches?: boolean }; delete?: { ok?: boolean } };
  const allGood = Boolean(s.put?.ok && s.get?.ok && s.get?.body_matches && s.delete?.ok);

  return json({
    ok: allGood,
    verdict: allGood ? "R2 read+write working" : "R2 NOT working — see steps",
    bucket,
    endpoint,
    public_url_set: present.CLOUDFLARE_R2_PUBLIC_URL,
    present,
    missing,
    steps,
  }, 200);
});
