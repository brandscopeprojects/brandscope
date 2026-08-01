import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentBrand } from "@/lib/data/brand";
import { hasOpenAiKey, OPENAI_CHAT_MODEL } from "@/lib/server/llm";
import { resolveModel } from "@/lib/server/model-router";
import { runBrandChatTurn, type BrandChatMessage } from "@/lib/brand-agent/engine";
import type { BrandToolContext } from "@/lib/brand-agent/tools";

/**
 * POST /api/chat — brand-facing chat, grounded in the brand's OWN scan data.
 *
 * Runs on the SAME OpenAI Responses API + server-side tool loop as the HQ Agent
 * (lib/brand-agent/engine.ts), with a brand-scoped, RLS-safe tool registry
 * (lib/brand-agent/tools.ts). This replaced the legacy Chat Completions path,
 * which had no tools (so it couldn't answer data questions) and was failing on the
 * `/v1/chat/completions` endpoint. Server-only; the OpenAI key never reaches the
 * client. Tools read via the caller's RLS-scoped client → strict brand isolation.
 */

export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 4000;
const HISTORY_LIMIT = 12;

export async function POST(req: Request) {
  const user = await requireUser();

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const conversationIdRaw = (payload as { conversationId?: unknown })?.conversationId;
  const messageRaw = (payload as { message?: unknown })?.message;

  const conversationId =
    typeof conversationIdRaw === "string" && conversationIdRaw ? conversationIdRaw : null;
  if (typeof messageRaw !== "string") {
    return NextResponse.json({ ok: false, error: "message is required." }, { status: 400 });
  }
  const message = messageRaw.trim();
  if (!message) {
    return NextResponse.json({ ok: false, error: "Type a question to send." }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ ok: false, error: "Message is too long." }, { status: 400 });
  }

  // Guard BEFORE writing anything so we never persist a user message we can't answer.
  if (!hasOpenAiKey()) {
    return NextResponse.json({ ok: false, error: "Chat is not configured." }, { status: 503 });
  }

  const brand = await getCurrentBrand();
  if (!brand) {
    return NextResponse.json({ ok: false, error: "No brand configured." }, { status: 400 });
  }

  const supabase = createClient();

  // --- Resolve / create the conversation (RLS-scoped to the brand) ------------
  let targetConversationId = conversationId;
  let priorCount = 0;

  if (!targetConversationId) {
    const { data: conversation, error: convError } = await supabase
      .from("chat_conversations")
      .insert({
        brand_id: brand.id,
        profile_id: user.id,
        title: deriveTitle(message),
        last_message_at: new Date().toISOString(),
        message_count: 0,
      })
      .select("id")
      .single();
    if (convError || !conversation) {
      return NextResponse.json(
        { ok: false, error: convError?.message ?? "Could not start the conversation." },
        { status: 500 },
      );
    }
    targetConversationId = conversation.id;
  } else {
    const { data: conv } = await supabase
      .from("chat_conversations")
      .select("id, message_count")
      .eq("id", targetConversationId)
      .maybeSingle();
    if (!conv) {
      return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
    }
    priorCount = conv.message_count ?? 0;
  }

  if (!targetConversationId) {
    return NextResponse.json({ ok: false, error: "Could not resolve the conversation." }, { status: 500 });
  }

  // --- Load recent history BEFORE inserting the new user message --------------
  const { data: historyRows } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("conversation_id", targetConversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history: BrandChatMessage[] = (historyRows ?? [])
    .slice()
    .reverse()
    .map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

  // --- Persist the user's message ---------------------------------------------
  const { error: userMsgError } = await supabase.from("chat_messages").insert({
    conversation_id: targetConversationId,
    role: "user",
    content: message,
  });
  if (userMsgError) {
    return NextResponse.json({ ok: false, error: userMsgError.message }, { status: 500 });
  }

  // --- Run the brand agent (Responses API + brand-scoped tools) ---------------
  const model = await resolveModel(createAdminClient(), "chat", OPENAI_CHAT_MODEL);
  const toolCtx: BrandToolContext = {
    supabase, // RLS-scoped → brand isolation enforced at the DB
    brandId: brand.id,
    brandName: brand.name,
    markets: brand.market,
  };

  const turn = await runBrandChatTurn({
    model,
    instructions: buildInstructions(brand),
    history,
    message,
    toolCtx,
    maxOutputTokens: 1024,
    signal: req.signal,
  });

  if (!turn.ok) {
    // User message is already stored; advance the stamp so the list re-sorts, then
    // return an honest error with the real upstream detail. No fabricated reply.
    await bumpConversation(supabase, targetConversationId, priorCount + 1);
    return NextResponse.json(
      {
        ok: false,
        conversationId: targetConversationId,
        error: `The assistant is unavailable: ${turn.error}`,
      },
      { status: 502 },
    );
  }

  const assistantContent = turn.text || "I couldn't produce an answer for that. Please rephrase.";

  // --- Persist the assistant reply --------------------------------------------
  const { error: assistantMsgError } = await supabase.from("chat_messages").insert({
    conversation_id: targetConversationId,
    role: "assistant",
    content: assistantContent,
    model_used: turn.model,
  });
  if (assistantMsgError) {
    return NextResponse.json(
      { ok: false, conversationId: targetConversationId, error: assistantMsgError.message },
      { status: 500 },
    );
  }

  await bumpConversation(supabase, targetConversationId, priorCount + 2);

  return NextResponse.json({
    ok: true,
    conversationId: targetConversationId,
    assistant: { content: assistantContent },
  });
}

type SupabaseClient = ReturnType<typeof createClient>;

async function bumpConversation(
  supabase: SupabaseClient,
  conversationId: string,
  messageCount: number,
): Promise<void> {
  await supabase
    .from("chat_conversations")
    .update({ last_message_at: new Date().toISOString(), message_count: messageCount })
    .eq("id", conversationId);
}

/** System prompt: the tools carry the data, so this stays short and strict. */
function buildInstructions(brand: { name: string; market: string[] }): string {
  const markets = brand.market.join(", ") || "unspecified markets";
  return [
    `You are Brandscope's brand-intelligence assistant for ${brand.name}, an iGaming brand competing in ${markets}.`,
    "Answer questions about this brand's competitive position using the provided tools to read its latest scan data.",
    "Rules: call a tool to get real figures — never invent metrics, competitors, sources, or a scan week.",
    "If a tool reports no data (available:false), say so plainly and, when useful, note that a scan may still be running or the module returned nothing for this market. Do not fabricate.",
    "Cite the scan week when you give figures. Be concise and specific; lead with the answer.",
  ].join(" ");
}

function deriveTitle(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 60) return collapsed;
  return `${collapsed.slice(0, 57).trimEnd()}…`;
}
