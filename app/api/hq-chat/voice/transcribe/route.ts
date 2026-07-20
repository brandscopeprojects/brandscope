import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import { hasOpenAiKey, transcribeAudio } from "@/lib/server/llm";

/**
 * POST /api/hq-chat/voice/transcribe — voice INPUT for the HQ Agent.
 *
 * Internal-admin only. Accepts a recorded audio blob (multipart form field
 * `audio`), runs OpenAI Whisper server-side, and returns `{ text }`. The OpenAI
 * key never leaves the server. Honest failure: 503 when the key is missing.
 */

export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // OpenAI transcription hard limit is 25 MB

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });

  if (!hasOpenAiKey()) {
    return NextResponse.json(
      { ok: false, error: "Voice is not configured (OpenAI key missing)." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected multipart form data." }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ ok: false, error: "No audio was recorded." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ ok: false, error: "Recording is too long." }, { status: 413 });
  }

  const filename = (audio as File).name || "recording.webm";
  const result = await transcribeAudio(audio, filename);
  if (!result.ok) {
    const status = result.reason === "not_configured" ? 503 : 502;
    return NextResponse.json({ ok: false, error: result.message }, { status });
  }

  return NextResponse.json({ ok: true, text: result.text });
}
