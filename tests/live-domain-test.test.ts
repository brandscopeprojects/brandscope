import { describe, it } from "vitest";
import { extractBrandAndMarkets } from "../lib/data/brand-market-extraction";
import * as fs from "fs";

describe("Live Domain Testing", () => {
  const report: string[] = [];

  it("Test Live Domains: SportPesa", async () => {
    report.push("\n## Live Domain Test: SportPesa");
    report.push("Domain: https://www.sportpesa.com/");
    report.push(`Timestamp: ${new Date().toISOString()}`);

    try {
      const result = await extractBrandAndMarkets("https://www.sportpesa.com/");
      report.push(`\nStatus: ${result.ok ? "SUCCESS" : "ERROR"}`);

      if (result.ok) {
        report.push(`Brand: ${result.brand_candidates[0]?.brand_name || "N/A"}`);
        report.push(`Markets Found: ${result.detected_markets.length}`);
        if (result.detected_markets.length > 0) {
          report.push(
            `Countries: ${result.detected_markets.map((m) => m.market_code).join(", ")}`
          );
        }
        report.push(`Fetch Status: ${result.extraction_metadata.primary_fetch_status}`);
        report.push(`Duration: ${result.extraction_metadata.fetch_duration_ms}ms`);
      } else {
        report.push(`Error: ${result.error}`);
      }
    } catch (error) {
      report.push(
        `Exception: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  it("Test Live Domains: Bet365", async () => {
    report.push("\n## Live Domain Test: Bet365");
    report.push("Domain: https://www.bet365.com/");
    report.push(`Timestamp: ${new Date().toISOString()}`);

    try {
      const result = await extractBrandAndMarkets("https://www.bet365.com/");
      report.push(`\nStatus: ${result.ok ? "SUCCESS" : "ERROR"}`);

      if (result.ok) {
        report.push(`Brand: ${result.brand_candidates[0]?.brand_name || "N/A"}`);
        report.push(`Markets Found: ${result.detected_markets.length}`);
        if (result.detected_markets.length > 0) {
          const markets = result.detected_markets.map((m) => m.market_code).join(", ");
          report.push(`Countries: ${markets.substring(0, 100)}...`);
        }
        report.push(`Fetch Status: ${result.extraction_metadata.primary_fetch_status}`);
        report.push(`Duration: ${result.extraction_metadata.fetch_duration_ms}ms`);
      } else {
        report.push(`Error: ${result.error}`);
      }
    } catch (error) {
      report.push(
        `Exception: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  it("Test Live Domains: BetVictor", async () => {
    report.push("\n## Live Domain Test: BetVictor");
    report.push("Domain: https://www.betvictor.com/");
    report.push(`Timestamp: ${new Date().toISOString()}`);

    try {
      const result = await extractBrandAndMarkets("https://www.betvictor.com/");
      report.push(`\nStatus: ${result.ok ? "SUCCESS" : "ERROR"}`);

      if (result.ok) {
        report.push(`Brand: ${result.brand_candidates[0]?.brand_name || "N/A"}`);
        report.push(`Markets Found: ${result.detected_markets.length}`);
        if (result.detected_markets.length > 0) {
          report.push(
            `Countries: ${result.detected_markets.map((m) => m.market_code).join(", ")}`
          );
        }
        report.push(`Fetch Status: ${result.extraction_metadata.primary_fetch_status}`);
        report.push(`Duration: ${result.extraction_metadata.fetch_duration_ms}ms`);
      } else {
        report.push(`Error: ${result.error}`);
      }
    } catch (error) {
      report.push(
        `Exception: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  it("Save live domain test report", async () => {
    report.unshift("# Live Domain Testing Report");
    report.unshift(`Generated: ${new Date().toISOString()}\n`);

    const reportText = report.join("\n");
    console.log("\n" + "=".repeat(80));
    console.log(reportText);
    console.log("=".repeat(80));

    fs.writeFileSync("/tmp/live-domain-test-results.md", reportText);
  });
});
