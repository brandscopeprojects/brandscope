import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import { resolveModel } from "@/lib/server/model-router";
import { CLAUDE_SONNET_MODEL, hasAnthropicKey } from "@/lib/server/llm";
import { HQ_TOOLS, HQ_SYSTEM_PROMPT } from "@/lib/server/hq-agent";

/**
 * POST /api/hq-chat — the internal HQ Agent (tool-calling ops copilot).
 *
 * Gate: internal_admin / super_admin only (JSON 403). Persistent since
 * migration 16: messages land in hq_conversations / hq_messages (creating the
 * conversation on first message), and ACTIVE rows from hq_agent_memory are
 * injected into the system prompt as owner-approved memory. Runs a hand-rolled
 * Claude tool-use loop (NO SDK — owner decision) over read-only HQ_TOOLS, max 6
 * rounds; returns the reply + tool trace + persisted ids/timestamps.
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

  // ── Resolve / create the conversation ──────────────────────────────────────
  let conversationId = typeof payload.conversationId === "string" ? payload.conversationId : null;
  if (conversationId) {
    const { data: conv } = await admin
      .from("hq_conversations")
      .select("id")
      .eq("id", conversationId)
      .single();
    if (!conv) conversationId = null;
  }
  if (!conversationId) {
    const { data: created, error } = await admin
      .from("hq_conversations")
      .insert({
        profile_id: userId,
        title: message.length > 64 ? `${message.slice(0, 61)}…` : message,
      })
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
      ? [
          "",
          "APPROVED MEMORY (owner-curated; treat as reliable context):",
          ...(memory ?? []).map((m) => `- [${m.kind}] ${m.content}`),
        ].join("\n")
      : "";
  const system = HQ_SYSTEM_PROMPT + memoryBlock;

  // ── Persist the user message ────────────────────────────────────────────────
  const { data: userMsg } = await admin
    .from("hq_messages")
    .insert({ conversation_id: conversationId, role: "user", content: message })
    .select("id, created_at")
    .single();

  const model = await resolveModel(admin, "internal_hq_chat", CLAUDE_SONNET_MODEL);
  const tools = HQ_TOOLS.map(({ name, description, input_schema }) => ({
    name,
    description,
    input_schema,
  }));

  const messages: Array<{ role: string; content: unknown }> = [
    ...(prior ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];
  const toolsUsed: string[] = [];

  for (let round = 0; round <= MAX_ROUNDS; round++) {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        temperature: 0.2,
        system,
        tools,
        messages,
      }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Model call failed (${res.status}).`, conversationId },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { content?: ContentBlock[]; stop_reason?: string };
    const blocks = data.content ?? [];

    if (data.stop_reason !== "tool_use") {
      const text = blocks
        .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      const reply = text || "I could not produce an answer — try rephrasing.";

      const { data: asstMsg } = await admin
        .from("hq_messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          content: reply,
          tools_used: toolsUsed,
          model,
        })
        .select("id, created_at")
        .single();
      await admin
        .from("hq_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          message_count: (prior?.length ?? 0) + 2,
        })
        .eq("id", conversationId);

      return NextResponse.json({
        ok: true,
        conversationId,
        reply,
        toolsUsed,
        userMessage: userMsg,
        assistantMessage: asstMsg,
      });
    }

    messages.push({ role: "assistant", content: blocks });
    const results = await Promise.all(
      blocks
        .filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use")
        .map(async (b) => {
          toolsUsed.push(b.name);
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

  return NextResponse.json(
    { ok: false, error: "The agent exceeded its tool budget — ask a narrower question.", conversationId },
    { status: 500 },
  );
}
