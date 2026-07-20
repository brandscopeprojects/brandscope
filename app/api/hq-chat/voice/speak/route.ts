import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import { hasOpenAiKey, synthesizeSpeech } from "@/lib/server/llm";

/**
 * POST /api/hq-chat/voice/speak — voice OUTPUT for the HQ Agent.
 *
 * Internal-admin only. Accepts `{ text }`, runs OpenAI TTS server-side, and
 * streams back MP3 audio for the client to play. The OpenAI key never leaves the
 * server. Honest failure: 503 (JSON) when the key is missing.
 */

export const dynamic = "force-dynamic";

const MAX_TTS_CHARS = 4000; // keep TTS calls bounded (OpenAI hard limit is 4096)

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  if (!hasOpenAiKey()) {
    return NextResponse.json(
      { ok: false, error: "Voice is not configured (OpenAI key missing)." },
      { status: 503 },
    );
  }

  let payload: { text?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) return NextResponse.json({ ok: false, error: "Nothing to speak." }, { status: 400 });

  const result = await synthesizeSpeech(text.slice(0, MAX_TTS_CHARS));
  if (!result.ok) {
    const status = result.reason === "not_configured" ? 503 : 502;
    return NextResponse.json({ ok: false, error: result.message }, { status });
  }

  return new Response(result.audio, {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "no-store",
    },
  });
}
