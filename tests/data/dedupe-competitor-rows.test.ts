import { describe, it, expect } from "vitest";
import { dedupeCompetitorRows } from "@/lib/data/competitor-cache-utils";

// dedupeCompetitorRows collapses shared-competitor cache rows to one row per
// (competitor_id, scan_week): the caller brand's OWN row wins, else the freshest.
const OWN = "brand-own";
const OTHER = "brand-other";

describe("dedupeCompetitorRows", () => {
  it("keeps a single row per competitor+week", () => {
    const rows = [
      { competitor_id: "c1", scan_week: "2026-08-10", brand_id: OTHER, created_at: "2026-08-10T00:00:00Z" },
      { competitor_id: "c1", scan_week: "2026-08-10", brand_id: OTHER, created_at: "2026-08-11T00:00:00Z" },
    ];
    const out = dedupeCompetitorRows(rows, OWN);
    expect(out).toHaveLength(1);
    // freshest of the two shared rows wins
    expect(out[0].created_at).toBe("2026-08-11T00:00:00Z");
  });

  it("prefers the caller brand's OWN row over any shared row, regardless of freshness", () => {
    const rows = [
      { competitor_id: "c1", scan_week: "2026-08-10", brand_id: OTHER, created_at: "2026-08-20T00:00:00Z" },
      { competitor_id: "c1", scan_week: "2026-08-10", brand_id: OWN, created_at: "2026-08-01T00:00:00Z" },
    ];
    const out = dedupeCompetitorRows(rows, OWN);
    expect(out).toHaveLength(1);
    expect(out[0].brand_id).toBe(OWN);
  });

  it("uses scraped_at ahead of created_at for the freshness tiebreak", () => {
    const rows = [
      { competitor_id: "c1", scan_week: "2026-08-10", brand_id: OTHER, created_at: "2026-08-01T00:00:00Z", scraped_at: "2026-08-19T00:00:00Z" },
      { competitor_id: "c1", scan_week: "2026-08-10", brand_id: OTHER, created_at: "2026-08-02T00:00:00Z", scraped_at: "2026-08-18T00:00:00Z" },
    ];
    const out = dedupeCompetitorRows(rows, OWN);
    expect(out).toHaveLength(1);
    expect(out[0].scraped_at).toBe("2026-08-19T00:00:00Z");
  });

  it("keeps different weeks and different competitors as distinct rows", () => {
    const rows = [
      { competitor_id: "c1", scan_week: "2026-08-10", brand_id: OTHER },
      { competitor_id: "c1", scan_week: "2026-08-03", brand_id: OTHER },
      { competitor_id: "c2", scan_week: "2026-08-10", brand_id: OTHER },
    ];
    const out = dedupeCompetitorRows(rows, OWN);
    expect(out).toHaveLength(3);
  });
});
