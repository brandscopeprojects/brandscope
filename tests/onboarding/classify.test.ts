import { describe, it, expect } from "vitest";
import {
  classifyOnboardingSuggestion,
  EMPTY_ONBOARDING_SUGGESTION,
} from "@/app/onboarding/action-types";

describe("classifyOnboardingSuggestion", () => {
  it("marks a request-level failure as 'error' with a generic message (no raw backend text)", () => {
    const r = classifyOnboardingSuggestion({ errored: true, requestId: "req-1" });
    expect(r.status).toBe("error");
    expect(r.requestId).toBe("req-1");
    if (r.status === "error") {
      expect(r.message).toMatch(/detection failed/i);
      expect(r.message).not.toMatch(/ReferenceError|stack|undefined is not/i);
    }
  });

  it("marks a successful-but-empty result as 'empty', NOT 'error'", () => {
    const r = classifyOnboardingSuggestion({ suggestions: EMPTY_ONBOARDING_SUGGESTION });
    expect(r.status).toBe("empty");
  });

  it("marks a result with competitors as 'success'", () => {
    const r = classifyOnboardingSuggestion({
      suggestions: { name: "Betpawa", markets: ["rwanda"], competitors: [{ domain: "betway.co.rw", name: "Betway", tier: "challenger" }] },
    });
    expect(r.status).toBe("success");
    expect(r.suggestions.competitors).toHaveLength(1);
  });

  it("treats markets-only (no competitors) as success, not empty", () => {
    const r = classifyOnboardingSuggestion({
      suggestions: { name: null, markets: ["rwanda"], competitors: [] },
    });
    expect(r.status).toBe("success");
  });
});
