import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import { hasAnthropicKey, CLAUDE_SONNET_MODEL } from "@/lib/server/llm";
import { HQ_TOOLS, HQ_SYSTEM_PROMPT } from "@/lib/server/hq-agent";
import { resolveHqRoute, loadActivePrompt, recentUserMessageCount } from "@/lib/server/hq-config";

/**
 * POST /api/hq-chat — the internal HQ Agent (tool-calling ops copilot), STREAMED.
 *
 * Gate: internal_admin / super_admin only (JSON 403). Config (model, temperature,
 * max_tokens, rate limit) comes from model_router_config slot 'internal_hq_chat';
 * the system prompt from prompt_versions slot 'internal_hq_chat' (both editable in
 * the admin settings panel, both fail safe to code defaults). Runs a hand-rolled
 * Claude tool-use loop (NO SDK) over read-only HQ_TOOLS; the assistant's text is
 * streamed to the client as Server-Sent Events, tool rounds run server-side, and
 * the full reply + trace are persisted when the stream settles.
 */

export const dynamic = "force-dynamic";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_ROUNDS = 6;
const MAX_HISTORY = 16;
const MAX_MESSAGE_LENGTH = 4000;
const MEMORY_LIMIT = 40;

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

function sse(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/** Stream one Anthropic round; forward text deltas via onText; return the
 *  assembled content blocks + stop_reason. */
async function streamRound(
  body: Record<string, unknown>,
  onText: (t: string) => void,
): Promise<{ blocks: ContentBlock[]; stopReason: string }> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`model call failed (${res.status})`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const acc: Array<{ type: string; text?: string; id?: string; name?: string; _json?: string; input?: unknown }> = [];
  let stopReason = "end_turn";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, nl);
      buf = buf.slice(nl + 2);
      const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const json = dataLine.slice(5).trim();
      if (!json || json === "[DONE]") continue;
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(json);
      } catch {
        continue;
      }
      const type = evt.type;
      if (type === "content_block_start") {
        const cb = (evt.content_block ?? {}) as { type?: string; id?: string; name?: string };
        acc[evt.index as number] =
          cb.type === "tool_use"
            ? { type: "tool_use", id: cb.id, name: cb.name, _json: "" }
            : { type: "text", text: "" };
      } else if (type === "content_block_delta") {
        const d = (evt.delta ?? {}) as { type?: string; text?: string; partial_json?: string };
        const b = acc[evt.index as number];
        if (b && d.type === "text_delta" && typeof d.text === "string") {
          b.text = (b.text ?? "") + d.text;
          onText(d.text);
        } else if (b && d.type === "input_json_delta" && typeof d.partial_json === "string") {
          b._json = (b._json ?? "") + d.partial_json;
        }
      } else if (type === "content_block_stop") {
        const b = acc[evt.index as number];
        if (b && b.type === "tool_use") {
          try {
            b.input = JSON.parse(b._json || "{}");
          } catch {
            b.input = {};
          }
        }
      } else if (type === "message_delta") {
        const sr = ((evt.delta ?? {}) as { stop_reason?: string }).stop_reason;
        if (sr) stopReason = sr;
      }
    }
  }

  const blocks: ContentBlock[] = acc
    .filter(Boolean)
    .map((b) =>
      b.type === "tool_use"
        ? { type: "tool_use", id: b.id!, name: b.name!, input: b.input ?? {} }
        : { type: "text", text: b.text ?? "" },
    );
  return { blocks, stopReason };
}

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  const { admin, userId } = ctx;

  if (!hasAnthropicKey()) {
    return NextResponse.json(
      { ok: false, error: "HQ Agent is not configured (Anthropic key missing)." },
      { status: 503 },
    );
  }

  let payload: { conversationId?: string | null; message?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message) return NextResponse.json({ ok: false, error: "Send a message." }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ ok: false, error: "Message is too long." }, { status: 400 });
  }

  // ── Runtime config + rate limit ─────────────────────────────────────────────
  const route = await resolveHqRoute(admin, {
    model: CLAUDE_SONNET_MODEL,
    temperature: 0.2,
    maxTokens: 1500,
    requestsPerMin: 20,
  });
  if (!route.active) {
    return NextResponse.json({ ok: false, error: "HQ Agent is disabled." }, { status: 503 });
  }
  if (route.requestsPerMin && route.requestsPerMin > 0) {
    const recent = await recentUserMessageCount(admin, userId, 60);
    if (recent >= route.requestsPerMin) {
      return NextResponse.json(
        { ok: false, error: `Rate limit reached (${route.requestsPerMin}/min). Give it a moment.` },
        { status: 429 },
      );
    }
  }

  // ── Resolve / create the conversation ──────────────────────────────────────
  let conversationId = typeof payload.conversationId === "string" ? payload.conversationId : null;
  if (conversationId) {
    const { data: conv } = await admin.from("hq_conversations").select("id").eq("id", conversationId).single();
    if (!conv) conversationId = null;
  }
  if (!conversationId) {
    const { data: created, error } = await admin
      .from("hq_conversations")
      .insert({ profile_id: userId, title: message.length > 64 ? `${message.slice(0, 61)}…` : message })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json({ ok: false, error: "Could not start conversation." }, { status: 500 });
    }
    conversationId = created.id;
  }

  // ── Load history + owner-approved memory ───────────────────────────────────
  const [{ data: prior }, { data: memory }] = await Promise.all([
    admin
      .from("hq_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY),
    admin
      .from("hq_agent_memory")
      .select("kind, content")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(MEMORY_LIMIT),
  ]);

  const memoryBlock =
    (memory ?? []).length > 0
      ? ["", "APPROVED MEMORY (owner-curated; treat as reliable context):", ...(memory ?? []).map((m) => `- [${m.kind}] ${m.content}`)].join("\n")
      : "";
  const system = (await loadActivePrompt(admin, HQ_SYSTEM_PROMPT)) + memoryBlock;

  // ── Persist the user message ────────────────────────────────────────────────
  const { data: userMsg } = await admin
    .from("hq_messages")
    .insert({ conversation_id: conversationId, role: "user", content: message })
    .select("id, created_at")
    .single();

  const tools = HQ_TOOLS.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
  const messages: Array<{ role: string; content: unknown }> = [
    ...(prior ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];
  const toolsUsed: string[] = [];
  const convId = conversationId;

  // ── Stream the assistant turn (SSE) ─────────────────────────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (o: unknown) => controller.enqueue(sse(o));
      let finalText = "";
      try {
        for (let round = 0; round <= MAX_ROUNDS; round++) {
          finalText = "";
          const { blocks, stopReason } = await streamRound(
            { model: route.model, max_tokens: route.maxTokens, temperature: route.temperature, system, tools, messages },
            (t) => {
              finalText += t;
              emit({ type: "delta", text: t });
            },
          );

          if (stopReason !== "tool_use") break;

          // Tool round: clear any interim text the client showed, run tools, loop.
          emit({ type: "reset" });
          messages.push({ role: "assistant", content: blocks });
          const toolUses = blocks.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
          const results = await Promise.all(
            toolUses.map(async (b) => {
              toolsUsed.push(b.name);
              emit({ type: "tool", name: b.name });
              const tool = HQ_TOOLS.find((t) => t.name === b.name);
              let content: string;
              try {
                content = tool
                  ? JSON.stringify(await tool.run(admin)).slice(0, 8000)
                  : JSON.stringify({ error: `unknown tool ${b.name}` });
              } catch (e) {
                content = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
              }
              return { type: "tool_result", tool_use_id: b.id, content };
            }),
          );
          messages.push({ role: "user", content: results });
        }

        const reply = finalText.trim() || "I could not produce an answer — try rephrasing.";
        const { data: asstMsg } = await admin
          .from("hq_messages")
          .insert({ conversation_id: convId, role: "assistant", content: reply, tools_used: toolsUsed, model: route.model })
          .select("id, created_at")
          .single();
        await admin
          .from("hq_conversations")
          .update({ last_message_at: new Date().toISOString(), message_count: (prior?.length ?? 0) + 2 })
          .eq("id", convId);

        emit({ type: "done", conversationId: convId, reply, toolsUsed, userMessage: userMsg, assistantMessage: asstMsg });
      } catch (e) {
        emit({ type: "error", error: e instanceof Error ? e.message : "The agent failed. Try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
