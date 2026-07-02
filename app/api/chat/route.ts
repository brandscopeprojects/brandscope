import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentBrand } from "@/lib/data/brand";
import { openAiChat, hasOpenAiKey, OPENAI_CHAT_MODEL, type ChatMessage } from "@/lib/server/llm";
import { resolveModel } from "@/lib/server/model-router";

/**
 * POST /api/chat — answer a brand-chat message with GPT-4.1 Mini, grounded in the
 * brand's own data.
 *
 * Flow (docs/skills/data-flow-rules.md §5, mvp-module-sources "Chat"):
 *  1. Auth + resolve the caller's brand.
 *  2. Build brand context SERVER-SIDE: profile + latest weekly_cache summary +
 *     recent open recommendations (RLS reads). Inject as a system prompt.
 *  3. Persist the user message (creating the conversation if null) via RLS client.
 *  4. Call GPT-4.1 Mini with context + recent history; persist the assistant reply.
 *  5. Advance the conversation's last_message_at / message_count.
 *
 * Supersedes the honest-stub assistant reply in app/(app)/chat/actions.ts. The
 * underlying message-persistence shape matches that action. Server-only; OpenAI key
 * via process.env. Missing key → honest "chat not configured" error (no fabrication).
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
    return NextResponse.json(
      { ok: false, error: "Chat is not configured." },
      { status: 503 },
    );
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
    // Confirm the conversation is visible under RLS (belongs to the brand).
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

  // --- Load recent history BEFORE inserting the new user message --------------
  const { data: historyRows } = await supabase
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("conversation_id", targetConversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history: ChatMessage[] = (historyRows ?? [])
    .slice()
    .reverse()
    .map((m) => ({
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

  // --- Build brand context server-side ----------------------------------------
  const systemPrompt = await buildSystemPrompt(supabase, brand);

  // Runtime model router (model_router_config is service-role-only → admin client).
  const model = await resolveModel(createAdminClient(), "chat", OPENAI_CHAT_MODEL);

  const completion = await openAiChat({
    system: systemPrompt,
    messages: [...history, { role: "user", content: message }],
    maxTokens: 1024,
    model,
  });

  if (!completion.ok) {
    // User message is already stored; advance the stamp so the list re-sorts, then
    // return an honest error. We do NOT insert a fabricated assistant row.
    await bumpConversation(supabase, targetConversationId, priorCount + 1);
    const status = completion.reason === "not_configured" ? 503 : 502;
    const error =
      completion.reason === "not_configured"
        ? "Chat is not configured."
        : "The assistant is unavailable right now. Please retry.";
    return NextResponse.json({ ok: false, conversationId: targetConversationId, error }, { status });
  }

  const assistantContent = completion.text || "I couldn't produce an answer for that. Please rephrase.";

  // --- Persist the assistant reply --------------------------------------------
  const { error: assistantMsgError } = await supabase.from("chat_messages").insert({
    conversation_id: targetConversationId,
    role: "assistant",
    content: assistantContent,
    model_used: completion.model,
    tokens_used: completion.totalTokens,
  });
  if (assistantMsgError) {
    return NextResponse.json(
      { ok: false, conversationId: targetConversationId, error: assistantMsgError.message },
      { status: 500 },
    );
  }

  // user + assistant = +2 messages.
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

async function buildSystemPrompt(
  supabase: SupabaseClient,
  brand: { id: string; name: string; market: string[] },
): Promise<string> {
  const markets = brand.market.join(", ");
  const parts: string[] = [
    markets
      ? `You are Brandscope's brand-intelligence assistant for an iGaming brand competing in ${markets}.`
      : "You are Brandscope's brand-intelligence assistant for an iGaming brand.",
    "Answer ONLY from the brand context below. If the data does not cover the question, say so plainly — never invent numbers, competitors, or sources.",
    `Brand: ${brand.name}. Markets: ${brand.market.join(", ") || "unspecified"}.`,
  ];

  // Latest weekly_cache summary (RLS read).
  const { data: cache } = await supabase
    .from("weekly_cache")
    .select(
      "scan_week, threat_level, threat_score, ai_visibility_score, sov_pct, competitors_tracked, active_ads_count, promo_changes_this_week",
    )
    .eq("brand_id", brand.id)
    .order("scan_week", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cache) {
    parts.push(
      `Latest scan week ${cache.scan_week}: threat ${cache.threat_level ?? "n/a"} (${cache.threat_score ?? "n/a"}), ` +
        `AI visibility ${cache.ai_visibility_score ?? "n/a"}, share-of-voice ${cache.sov_pct ?? "n/a"}%, ` +
        `${cache.competitors_tracked ?? 0} competitors tracked, ${cache.active_ads_count ?? 0} active ads, ` +
        `${cache.promo_changes_this_week ?? 0} promo changes this week.`,
    );

    // Recent open recommendations for that scan week.
    const { data: recs } = await supabase
      .from("recommendations")
      .select("headline, urgency, trigger_reason, rank")
      .eq("brand_id", brand.id)
      .eq("scan_week", cache.scan_week)
      .eq("status", "open")
      .order("rank", { ascending: true })
      .limit(8);

    if (recs && recs.length > 0) {
      const lines = recs
        .map((r) => `- [${r.urgency}] ${r.headline} — ${r.trigger_reason}`)
        .join("\n");
      parts.push(`Open recommendations:\n${lines}`);
    } else {
      parts.push("No open recommendations for the latest scan week.");
    }
  } else {
    parts.push("No weekly scan data is available yet for this brand.");
  }

  return parts.join("\n\n");
}

function deriveTitle(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= 60) return collapsed;
  return `${collapsed.slice(0, 57).trimEnd()}…`;
}
