import "server-only";

// Brand chat engine — the SAME OpenAI Responses API + server-side tool loop the HQ
// Agent uses (app/api/hq-agent/chat/route.ts), run to completion (non-streaming) so
// the existing brand-chat UI keeps its simple JSON contract. This replaces the
// legacy Chat Completions path (lib/server/llm.ts openAiChat) that couldn't call
// tools and was failing in production. Reuses the shared server-only OpenAI client.

import { openai } from "@/lib/hq-agent/openai";
import { brandToolsForModel, getBrandTool, type BrandToolContext } from "./tools";

export type BrandChatMessage = { role: "user" | "assistant"; content: string };

export type BrandTurnResult =
  | { ok: true; text: string; toolsUsed: string[]; sources: string[]; model: string }
  | { ok: false; error: string };

const MAX_ROUNDS = 5; // model ↔ tool round-trips before we stop
const MAX_TOOL_CALLS_PER_ROUND = 6;
const TOOL_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`tool timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

type ResponseItem = Record<string, unknown>;

/**
 * Run one brand-chat turn: seed the model with recent history + the new message,
 * let it call the brand-scoped tools, feed results back, and return the final text.
 * Never throws — returns a typed failure with the real upstream message so the
 * route can surface it (no more swallowed "unavailable").
 */
export async function runBrandChatTurn(args: {
  model: string;
  instructions: string;
  history: BrandChatMessage[];
  message: string;
  toolCtx: BrandToolContext;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}): Promise<BrandTurnResult> {
  const client = openai();
  const tools = brandToolsForModel();
  const toolsUsed: string[] = [];
  const sources: string[] = [];

  let input: ResponseItem[] = [
    ...args.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: args.message },
  ];
  let previousResponseId: string | undefined;

  try {
    for (let round = 0; round <= MAX_ROUNDS; round++) {
      const params: Record<string, unknown> = {
        model: args.model,
        instructions: args.instructions,
        input,
        tools,
        max_output_tokens: args.maxOutputTokens ?? 1024,
        store: true,
      };
      if (previousResponseId) params.previous_response_id = previousResponseId;

      const resp = (await client.responses.create(params as never, {
        signal: args.signal,
      })) as unknown as { id?: string; output_text?: string; output?: ResponseItem[] };

      previousResponseId = resp.id;
      const output = Array.isArray(resp.output) ? resp.output : [];
      const functionCalls = output.filter((i) => (i as { type?: string }).type === "function_call");

      if (functionCalls.length === 0) {
        const text = (resp.output_text ?? "").trim();
        return { ok: true, text, toolsUsed, sources, model: args.model };
      }

      // Run the requested tools and feed the outputs back on the next round.
      const outputs: ResponseItem[] = [];
      for (const call of functionCalls.slice(0, MAX_TOOL_CALLS_PER_ROUND)) {
        const name = String((call as { name?: unknown }).name ?? "");
        const callId = String((call as { call_id?: unknown }).call_id ?? "");
        const rawArgs = (call as { arguments?: unknown }).arguments;
        toolsUsed.push(name);

        let parsed: Record<string, unknown> = {};
        try {
          parsed = typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : {};
        } catch {
          parsed = {};
        }

        const tool = getBrandTool(name);
        let outStr: string;
        if (!tool) {
          outStr = JSON.stringify({ error: `unknown tool ${name}` });
        } else {
          try {
            const result = await withTimeout(tool.run(args.toolCtx, parsed), TOOL_TIMEOUT_MS);
            if (result.source) sources.push(result.source);
            outStr = JSON.stringify(result.data).slice(0, 8000);
          } catch (e) {
            outStr = JSON.stringify({ error: e instanceof Error ? e.message : "tool failed" });
          }
        }
        outputs.push({ type: "function_call_output", call_id: callId, output: outStr });
      }
      // Subsequent rounds carry context via previous_response_id, so send only the
      // new tool outputs as input.
      input = outputs;
    }

    // Ran out of rounds without a final text answer.
    return { ok: true, text: "I couldn't complete that — try rephrasing.", toolsUsed, sources, model: args.model };
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return { ok: false, error: "aborted" };
    return { ok: false, error: e instanceof Error ? e.message : "The assistant is unavailable." };
  }
}
