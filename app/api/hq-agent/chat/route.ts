import { NextResponse } from "next/server";
import { getInternalCtx } from "@/lib/server/internal-guard";
import { hasOpenAiKey, textModel, loadPublishedConfig } from "@/lib/hq-agent/config";
import { openai, safetyIdentifier } from "@/lib/hq-agent/openai";
import { buildTextSystemPrompt } from "@/lib/hq-agent/system-prompt";
import { toolsForModel, runTool, MAX_TOOLS_PER_TURN } from "@/lib/hq-agent/tools/registry";
import {
  resolveConversation,
  loadRecentMessages,
  insertMessage,
  bumpConversation,
  recentUserMessageCount,
  loadMemoryBlock,
} from "@/lib/hq-agent/conversation";
import type { HqChatEvent, HqSource, HqToolContext } from "@/lib/hq-agent/types";

/**
 * POST /api/hq-agent/chat — HQ Agent text chat over the OpenAI Responses API,
 * streamed to the client as SSE. Internal-admin only. Runs a server-side tool
 * loop over the approved read-only registry; the OpenAI key never leaves the
 * server. Cancellation: the client can abort the fetch (or POST {stop:true}) and
 * we abort the upstream OpenAI request via the request signal.
 */

export const dynamic = "force-dynamic";

const MAX_ROUNDS = 6;
const MAX_MESSAGE_LENGTH = 4000;

function sse(evt: HqChatEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(evt)}\n\n`);
}

type ResponseInputItem = Record<string, unknown>;

export async function POST(req: Request) {
  const ctx = await getInternalCtx();
  if (!ctx) return NextResponse.json({ ok: false, error: "Internal admins only." }, { status: 403 });
  const { admin, userId, role } = ctx;

  if (!hasOpenAiKey()) {
    return NextResponse.json({ ok: false, error: "HQ Agent is not configured (OpenAI key missing)." }, { status: 503 });
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

  const config = await loadPublishedConfig(admin);
  if (!config.text.enabled) {
    return NextResponse.json({ ok: false, error: "Text chat is disabled." }, { status: 503 });
  }

  // Rate limit (§15).
  if (config.usage.textRequestsPerMin > 0) {
    const recent = await recentUserMessageCount(admin, userId, 60);
    if (recent >= config.usage.textRequestsPerMin) {
      return NextResponse.json(
        { ok: false, error: `Rate limit reached (${config.usage.textRequestsPerMin}/min). Give it a moment.` },
        { status: 429 },
      );
    }
  }

  const conversationId = await resolveConversation(admin, userId, payload.conversationId ?? null, message);
  if (!conversationId) {
    return NextResponse.json({ ok: false, error: "Could not start conversation." }, { status: 500 });
  }

  const [prior, memoryBlock] = await Promise.all([
    loadRecentMessages(admin, conversationId, config.text.recentMessageLimit),
    loadMemoryBlock(admin),
  ]);
  const instructions = buildTextSystemPrompt(config, memoryBlock);

  const userMsg = await insertMessage(admin, { conversationId, role: "user", content: message, modality: "text" });

  const tools = toolsForModel(config);
  const model = textModel();
  const toolCtx: HqToolContext = { admin, profileId: userId, role, modality: "text" };
  const toolsUsed: string[] = [];
  const sources: HqSource[] = [];

  // Build the initial Responses input from the recent window + the new message.
  const input: ResponseInputItem[] = [
    ...prior.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: HqChatEvent) => controller.enqueue(sse(e));
      const client = openai();
      let finalText = "";
      let previousResponseId: string | undefined;
      let nextInput: ResponseInputItem[] = input;

      try {
        for (let round = 0; round <= MAX_ROUNDS; round++) {
          finalText = "";
          const params: Record<string, unknown> = {
            model,
            instructions,
            input: nextInput,
            tools,
            max_output_tokens: config.text.maxOutputTokens,
            store: true,
            safety_identifier: safetyIdentifier(userId),
            stream: true,
          };
          if (previousResponseId) params.previous_response_id = previousResponseId;

          const events = await client.responses.create(params as never, { signal: req.signal });
          const functionCalls: { name: string; callId: string; args: string }[] = [];

          // @ts-expect-error the streaming overload returns an async iterable of events
          for await (const event of events) {
            const type = (event as { type?: string }).type;
            if (type === "response.output_text.delta") {
              const delta = (event as { delta?: string }).delta ?? "";
              finalText += delta;
              emit({ type: "delta", text: delta });
            } else if (type === "response.completed") {
              const output = (event as { response?: { id?: string; output?: Array<Record<string, unknown>> } }).response;
              previousResponseId = output?.id;
              for (const item of output?.output ?? []) {
                if (item.type === "function_call") {
                  functionCalls.push({
                    name: String(item.name),
                    callId: String(item.call_id),
                    args: typeof item.arguments === "string" ? item.arguments : "{}",
                  });
                }
              }
            } else if (type === "response.failed" || type === "error") {
              throw new Error("The model response failed.");
            }
          }

          if (functionCalls.length === 0) break;

          // Tool round: run the calls, feed outputs back, clear interim text.
          emit({ type: "reset" });
          finalText = "";
          const outputs: ResponseInputItem[] = [];
          for (const call of functionCalls.slice(0, MAX_TOOLS_PER_TURN)) {
            emit({ type: "tool", name: call.name });
            toolsUsed.push(call.name);
            let parsed: unknown = {};
            try {
              parsed = JSON.parse(call.args || "{}");
            } catch {
              parsed = {};
            }
            const outcome = await runTool(toolCtx, config, call.name, parsed, conversationId);
            let output: string;
            if (outcome.ok && outcome.result) {
              for (const s of outcome.result.sources) sources.push(s);
              output = JSON.stringify(outcome.result.data).slice(0, 8000);
            } else {
              output = JSON.stringify({ error: outcome.error ?? "tool failed" });
            }
            outputs.push({ type: "function_call_output", call_id: call.callId, output });
          }
          nextInput = outputs;
        }

        const reply = finalText.trim() || "I could not produce an answer — try rephrasing.";
        if (config.data.showSources && sources.length > 0) {
          emit({ type: "sources", sources: dedupeSources(sources) });
        }
        const asstMsg = await insertMessage(admin, {
          conversationId,
          role: "assistant",
          content: reply,
          modality: "text",
          model,
          toolsUsed,
          metadata: config.data.showSources ? { sources: dedupeSources(sources) } : undefined,
        });
        await bumpConversation(admin, conversationId, 2);
        emit({
          type: "done",
          conversationId,
          reply,
          toolsUsed,
          messageId: asstMsg?.id,
          createdAt: asstMsg?.created_at,
          userMessageId: userMsg?.id,
        });
      } catch (e) {
        const aborted = (e as { name?: string }).name === "AbortError";
        if (!aborted) emit({ type: "error", error: e instanceof Error ? e.message : "The agent failed. Try again." });
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

function dedupeSources(sources: HqSource[]): HqSource[] {
  const seen = new Set<string>();
  const out: HqSource[] = [];
  for (const s of sources) {
    const key = `${s.service}|${s.dateRange ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}
