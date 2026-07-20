import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import { loadPublishedConfig } from "@/lib/hq-agent/config";
import { runTool } from "@/lib/hq-agent/tools/registry";
import type { HqToolContext } from "@/lib/hq-agent/types";

/**
 * POST /api/hq-agent/realtime/tool — execute one approved HQ tool for a voice
 * session. The Realtime model requests a function call over the WebRTC data
 * channel; the browser forwards {name, arguments, conversationId} here, we run
 * the SAME server-side registry (auth + validation + logging + freshness) as text
 * chat, and return the JSON output for the browser to hand back to the model.
 * Tools NEVER run in the browser and NEVER touch arbitrary tables.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  const { admin, userId, role } = ctx;

  let body: { name?: string; arguments?: unknown; conversationId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.name) return NextResponse.json({ ok: false, error: "Tool name required." }, { status: 400 });

  const config = await loadPublishedConfig(admin);
  const toolCtx: HqToolContext = { admin, profileId: userId, role, modality: "voice" };
  const outcome = await runTool(toolCtx, config, body.name, body.arguments ?? {}, body.conversationId ?? null);

  if (!outcome.ok) {
    return NextResponse.json({ ok: true, output: JSON.stringify({ error: outcome.error ?? "tool failed" }) });
  }
  return NextResponse.json({
    ok: true,
    output: JSON.stringify(outcome.result?.data ?? {}).slice(0, 8000),
    sources: config.data.showSources ? outcome.result?.sources ?? [] : [],
  });
}
