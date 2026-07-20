import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the internal-admin guard so we can drive authorised / unauthorised states
// without a real Supabase session. OpenAI is never reached in these paths.
const getInternalCtx = vi.fn();
vi.mock("@/lib/server/internal-guard", () => ({ getInternalCtx: () => getInternalCtx() }));

import { POST as chatPOST } from "@/app/api/hq-agent/chat/route";
import { POST as realtimePOST } from "@/app/api/hq-agent/realtime/session/route";

function req(body: unknown = { message: "hi" }): Request {
  return new Request("http://test/api", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

describe("HQ Agent route authorisation", () => {
  beforeEach(() => getInternalCtx.mockReset());

  it("chat rejects an unauthenticated / non-admin caller with 403", async () => {
    getInternalCtx.mockResolvedValue(null);
    const res = await chatPOST(req());
    expect(res.status).toBe(403);
  });

  it("realtime session mint rejects a non-admin caller with 403", async () => {
    getInternalCtx.mockResolvedValue(null);
    const res = await realtimePOST();
    expect(res.status).toBe(403);
  });

  it("chat returns 503 (not a crash) when the OpenAI key is missing", async () => {
    getInternalCtx.mockResolvedValue({ admin: {}, userId: "u1", role: "super_admin" });
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const res = await chatPOST(req());
    expect(res.status).toBe(503);
    if (prev) process.env.OPENAI_API_KEY = prev;
  });

  it("realtime session returns 503 when the OpenAI key is missing", async () => {
    getInternalCtx.mockResolvedValue({ admin: {}, userId: "u1", role: "super_admin" });
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const res = await realtimePOST();
    expect(res.status).toBe(503);
    if (prev) process.env.OPENAI_API_KEY = prev;
  });
});
