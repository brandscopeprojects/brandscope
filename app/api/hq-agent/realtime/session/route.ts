import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import { hasOpenAiKey, realtimeModel, loadPublishedConfig } from "@/lib/hq-agent/config";
import { openai, safetyIdentifier } from "@/lib/hq-agent/openai";
import { buildVoiceInstructions } from "@/lib/hq-agent/system-prompt";
import { realtimeToolsForModel } from "@/lib/hq-agent/tools/registry";
import { recentRealtimeSessions, logRealtimeSession } from "@/lib/hq-agent/realtime-usage";

/**
 * POST /api/hq-agent/realtime/session — mint a SHORT-LIVED Realtime client secret
 * for the browser to open a WebRTC session. Internal-admin only. The permanent
 * OPENAI_API_KEY is used only here (server-side) and never returned; the browser
 * receives only the ephemeral `value` (ek_…) + safe session config. Rate-limited
 * per §15 to prevent accidental multiple/abusive sessions.
 */

export const dynamic = "force-dynamic";

export async function POST() {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  const { admin, userId } = ctx;

  if (!hasOpenAiKey()) {
    return NextResponse.json({ ok: false, error: "Voice is not configured (OpenAI key missing)." }, { status: 503 });
  }

  const config = await loadPublishedConfig(admin);
  if (!config.voice.enabled) {
    return NextResponse.json({ ok: false, error: "Voice mode is disabled." }, { status: 503 });
  }

  // Rate limit realtime session creation (§15).
  if (config.usage.realtimeSessionsPerHour > 0) {
    const recent = await recentRealtimeSessions(admin, userId, 3600);
    if (recent >= config.usage.realtimeSessionsPerHour) {
      return NextResponse.json(
        { ok: false, error: `Voice session limit reached (${config.usage.realtimeSessionsPerHour}/hour).` },
        { status: 429 },
      );
    }
  }

  const model = realtimeModel();
  const instructions = buildVoiceInstructions(config);

  try {
    const secret = await openai().realtime.clientSecrets.create({
      expires_after: { anchor: "created_at", seconds: 600 },
      session: {
        type: "realtime",
        model,
        instructions,
        output_modalities: ["audio"],
        max_output_tokens: Math.max(256, Math.round(config.voice.maxSpokenResponseSeconds * 20)),
        audio: {
          input: {
            transcription: { model: "whisper-1" },
            turn_detection: config.voice.turnDetection ? { type: "server_vad" } : null,
          },
          output: { voice: config.voice.voice },
        },
        tools: realtimeToolsForModel(config),
      },
    } as never);

    await logRealtimeSession(admin, userId);

    return NextResponse.json({
      ok: true,
      value: (secret as { value: string }).value,
      expiresAt: (secret as { expires_at: number }).expires_at,
      model,
      voice: config.voice.voice,
      transcriptVisible: config.voice.transcriptVisible,
      interruptions: config.voice.interruptions,
      maxSessionMinutes: config.voice.maxSessionMinutes,
      idleTimeoutSeconds: config.voice.idleTimeoutSeconds,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Could not create a voice session." },
      { status: 502 },
    );
  }
}
