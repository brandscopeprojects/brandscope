import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveModel } from "@/lib/server/model-router";
import { CLAUDE_SONNET_MODEL, hasAnthropicKey } from "@/lib/server/llm";
import { HQ_TOOLS, HQ_SYSTEM_PROMPT } from "@/lib/server/hq-agent";

/**
 * POST /api/hq-chat — the internal HQ Agent (tool-calling ops copilot).
 *
 * Gate: internal_admin / super_admin ONLY (profiles.role via service client —
 * same check as the /brandscope-admin middleware; JSON 403 instead of redirect
 * because this is an API). Runs a Claude tool-use loop (max 6 rounds) over the
 * read-only HQ_TOOLS; returns the final text plus the tool trace so the UI can
 * show what was consulted. Conversations are ephemeral in v1 (no persistence —
 * chat_conversations is brand-scoped by schema).
 */

export const dynamic = "force-dynamic";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_ROUNDS = 6;
const MAX_HISTORY = 16;
const MAX_MESSAGE_LENGTH = 4000;

type WireMessage = { role: "user" | "assistant"; content: string };

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

export async function POST(req: Request) {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["internal_admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  }

  if (!hasAnthropicKey()) {
    return NextResponse.json(
      { ok: false, error: "HQ Agent is not configured (Anthropic key missing)." },
      { status: 503 },
    );
  }

  let payload: { messages?: WireMessage[] };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const history = (payload.messages ?? [])
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ ok: false, error: "Send a user message." }, { status: 400 });
  }

  const model = await resolveModel(admin, "internal_hq_chat", CLAUDE_SONNET_MODEL);
  const tools = HQ_TOOLS.map(({ name, description, input_schema }) => ({
    name,
    description,
    input_schema,
  }));

  // Anthropic tool-use loop. `messages` accumulates assistant tool_use blocks and
  // our tool_result replies until the model stops asking for tools.
  const messages: Array<{ role: string; content: unknown }> = [...history];
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
        system: HQ_SYSTEM_PROMPT,
        tools,
        messages,
      }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Model call failed (${res.status}).` },
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
      return NextResponse.json({
        ok: true,
        reply: text || "I could not produce an answer — try rephrasing.",
        toolsUsed,
      });
    }

    // Execute every requested tool (read-only) and feed results back.
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
    { ok: false, error: "The agent exceeded its tool budget — ask a narrower question." },
    { status: 500 },
  );
}
