import { describe, it, expect } from "vitest";
import { validatePeriodArg, resolvePeriod } from "@/lib/hq-agent/tools/shared";
import { getTool, enabledTools, toolsForModel } from "@/lib/hq-agent/tools/registry";
import { DEFAULT_HQ_CONFIG, normalizeConfig, validateHqEnv, mergeConfig } from "@/lib/hq-agent/config";
import { buildTextSystemPrompt } from "@/lib/hq-agent/system-prompt";

describe("tool input validation", () => {
  it("accepts a valid period and defaults an absent one", () => {
    expect(validatePeriodArg({ period: "last_7_days" })).toEqual({ period: "last_7_days" });
    expect(validatePeriodArg({})).toEqual({ period: "last_30_days" });
  });

  it("rejects an invalid period", () => {
    expect(() => validatePeriodArg({ period: "since_forever" })).toThrow(/invalid 'period'/);
    expect(() => validatePeriodArg({ period: 5 })).toThrow(/invalid 'period'/);
  });

  it("resolves a period to a bounded UTC start", () => {
    const r = resolvePeriod("last_7_days");
    expect(r.days).toBe(7);
    expect(new Date(r.sinceIso).getTime()).toBeLessThan(Date.now());
  });
});

describe("registry", () => {
  it("exposes the campaigns tool as an honest not-available adapter", async () => {
    const tool = getTool("get_campaign_performance");
    expect(tool).toBeDefined();
    const result = await tool!.run({ admin: {} as never, profileId: "u", role: "super_admin", modality: "text" }, { period: "last_30_days" });
    expect(result.notAvailable).toBe(true);
    expect((result.data as { available: boolean }).available).toBe(false);
  });

  it("withholds tools whose category is disabled", () => {
    const config = mergeConfig({ data: { categories: { finance: false } } });
    const names = enabledTools(config).map((t) => t.name);
    expect(names).not.toContain("get_revenue_summary");
    expect(names).toContain("get_management_briefing");
    expect(toolsForModel(config).every((t) => t.type === "function")).toBe(true);
  });
});

describe("config normalization", () => {
  it("clamps out-of-range numbers and coerces enums", () => {
    const c = normalizeConfig({
      text: { maxOutputTokens: 999999, recentMessageLimit: 0, responseStyle: "verbose" },
      voice: { voice: "not-a-voice", maxSessionMinutes: 9999 },
      usage: { textRequestsPerMin: -5 },
    });
    expect(c.text.maxOutputTokens).toBe(4096);
    expect(c.text.recentMessageLimit).toBe(4);
    expect(c.text.responseStyle).toBe("concise");
    expect(c.voice.voice).toBe("alloy");
    expect(c.voice.maxSessionMinutes).toBe(30);
    expect(c.usage.textRequestsPerMin).toBe(0);
  });

  it("merges partial config over defaults without dropping keys", () => {
    const c = mergeConfig({ identity: { name: "Ops Bot" } });
    expect(c.identity.name).toBe("Ops Bot");
    expect(c.identity.suggestedQuestions.length).toBeGreaterThan(0);
    expect(c.text.enabled).toBe(DEFAULT_HQ_CONFIG.text.enabled);
  });
});

describe("env validation", () => {
  it("flags a missing OPENAI_API_KEY", () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const v = validateHqEnv();
    expect(v.ok).toBe(false);
    expect(v.missing).toContain("OPENAI_API_KEY");
    if (prev) process.env.OPENAI_API_KEY = prev;
  });
});

describe("system prompt", () => {
  it("always includes the platform honesty rule and appends restricted topics", () => {
    const config = mergeConfig({ instructions: { restrictedTopics: "no legal advice" } });
    const prompt = buildTextSystemPrompt(config, "");
    expect(prompt).toContain("I could not confirm that from the available Brandscope data");
    expect(prompt).toContain("no legal advice");
  });
});
