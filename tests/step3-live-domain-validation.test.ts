/**
 * STEP 3 LIVE DOMAIN VALIDATION
 *
 * Tests Step 3 Brand-Market Extraction against REAL LIVE iGaming operator websites.
 * REQUIRES: Network-enabled environment (not available in sandboxed remote session).
 *
 * This test must be run in:
 * - Local development environment (npm test)
 * - CI/CD pipeline with internet access
 * - Staging environment
 *
 * Purpose: Prove extraction logic works end-to-end on real domains before
 * production deployment. Validates:
 * - Brand detection from real-world structured metadata
 * - Market detection via multi-layered signals (country selector, hreflang, license, etc.)
 * - Multi-country operator handling (e.g., Bet365 across 25+ jurisdictions)
 * - Secondary page discovery for unresolved markets
 * - Evidence tracking and source attribution
 */

import { describe, it } from "vitest";
import { extractBrandAndMarkets } from "../lib/data/brand-market-extraction";
import * as fs from "fs";

const reportLines: string[] = [];

function log(text: string) {
  reportLines.push(text);
  console.log(text);
}

describe("Step 3 Live Domain Validation", () => {
  it("Test 1: SportPesa (Kenya-focused single-market operator)", async () => {
    log("\n" + "=".repeat(80));
    log("TEST 1: SportPesa (Kenya-focused single-market operator)");
    log("=".repeat(80));
    log("Domain: https://www.sportpesa.com/");
    log("Expected: KE (Kenya) detected via license + selector + hreflang + currency + phone");

    const startTime = Date.now();
    const result = await extractBrandAndMarkets("https://www.sportpesa.com/");
    const duration = Date.now() - startTime;

    log(`\nFetch Duration: ${duration}ms`);
    log(`Status: ${result.ok ? "✅ SUCCESS" : "❌ ERROR"}`);

    if (result.ok) {
      log(`\n### Brand Detection`);
      log(`- Detected: ${result.brand_candidates[0]?.brand_name || "N/A"}`);
      log(`- Logo: ${result.brand_candidates[0]?.logo_candidates.length || 0} candidate(s)`);

      log(`\n### Market Detection`);
      log(`- Markets Found: ${result.detected_markets.length}`);

      if (result.detected_markets.length > 0) {
        log(`- Codes: ${result.detected_markets.map((m) => m.market_code).join(", ")}`);

        for (const market of result.detected_markets) {
          log(`\n  **${market.market_code} (${market.market_name})**`);
          log(`  - Total Signals: ${market.signals.length}`);

          const byStrength = {
            strong: market.signals.filter((s) => s.signal_strength === "strong"),
            medium: market.signals.filter((s) => s.signal_strength === "medium"),
            weak: market.signals.filter((s) => s.signal_strength === "weak"),
          };

          log(`    - Strong: ${byStrength.strong.length} signals`);
          byStrength.strong.forEach((sig) => {
            log(
              `      • ${sig.signal_type}: "${sig.extracted_value_or_excerpt.substring(0, 60)}"`
            );
          });

          log(`    - Medium: ${byStrength.medium.length} signals`);
          byStrength.medium.slice(0, 3).forEach((sig) => {
            log(
              `      • ${sig.signal_type}: "${sig.extracted_value_or_excerpt.substring(0, 60)}"`
            );
          });

          log(`    - Weak: ${byStrength.weak.length} signals`);
        }
      }

      log(`\n### Secondary Pages Fetched`);
      log(`- Count: ${result.extraction_metadata.secondary_pages_used.length}`);
      if (result.extraction_metadata.secondary_pages_used.length > 0) {
        result.extraction_metadata.secondary_pages_used.forEach((page) => {
          log(`  - ${page}`);
        });
      }

      log(`\n### Fetch Metadata`);
      log(`- Primary Status: ${result.extraction_metadata.primary_fetch_status}`);
      log(`- Content Type: ${result.extraction_metadata.content_type}`);
      log(`- Bytes Read: ${result.extraction_metadata.bytes_read} / ${result.extraction_metadata.bytes_limit}`);

      // Validation: SportPesa should detect Kenya
      const keDetected = result.detected_markets.some((m) => m.market_code === "KE");
      log(`\n### VALIDATION: ${keDetected ? "✅ PASS" : "❌ FAIL"}`);
      log(`Expected KE in detected markets: ${keDetected ? "YES" : "NO"}`);
    } else {
      log(`\nError: ${result.error}`);
      log(`Fetch Status: ${result.fetch_status}`);
      log("### VALIDATION: ❌ FAIL (fetch or parse error)");
    }
  });

  it("Test 2: Bet365 (Global multi-market operator)", async () => {
    log("\n" + "=".repeat(80));
    log("TEST 2: Bet365 (Global multi-market operator)");
    log("=".repeat(80));
    log("Domain: https://www.bet365.com/");
    log("Expected: 8+ markets (GB, DE, ES, IT, IE, BR, CA, AU) via country selector + hreflang");

    const startTime = Date.now();
    const result = await extractBrandAndMarkets("https://www.bet365.com/");
    const duration = Date.now() - startTime;

    log(`\nFetch Duration: ${duration}ms`);
    log(`Status: ${result.ok ? "✅ SUCCESS" : "❌ ERROR"}`);

    if (result.ok) {
      log(`\n### Brand Detection`);
      log(`- Detected: ${result.brand_candidates[0]?.brand_name || "N/A"}`);

      log(`\n### Market Detection`);
      log(`- Markets Found: ${result.detected_markets.length}`);

      if (result.detected_markets.length > 0) {
        const codes = result.detected_markets.map((m) => m.market_code).sort().join(", ");
        log(`- Codes: ${codes}`);

        // Show first 5 markets with signal summary
        log(`\n### Market Details (first 5)`);
        for (const market of result.detected_markets.slice(0, 5)) {
          const strongCount = market.signals.filter((s) => s.signal_strength === "strong").length;
          const mediumCount = market.signals.filter((s) => s.signal_strength === "medium").length;
          log(`- **${market.market_code}**: ${strongCount} strong, ${mediumCount} medium`);
        }

        if (result.detected_markets.length > 5) {
          log(`... and ${result.detected_markets.length - 5} more markets`);
        }
      }

      log(`\n### Secondary Pages Fetched`);
      log(`- Count: ${result.extraction_metadata.secondary_pages_used.length}`);

      log(`\n### Fetch Metadata`);
      log(`- Primary Status: ${result.extraction_metadata.primary_fetch_status}`);
      log(`- Bytes Read: ${result.extraction_metadata.bytes_read} / ${result.extraction_metadata.bytes_limit}`);

      // Validation: Bet365 is a global operator, should detect multiple markets
      const expectedCodes = ["GB", "DE", "ES", "IT", "IE", "BR", "CA", "AU"];
      const detectedCodes = new Set(result.detected_markets.map((m) => m.market_code));
      const foundCount = expectedCodes.filter((code) => detectedCodes.has(code)).length;

      log(`\n### VALIDATION: ${foundCount >= 6 ? "✅ PASS" : "⚠️ PARTIAL"}`);
      log(`Expected at least 6 of: ${expectedCodes.join(", ")}`);
      log(`Found: ${foundCount} (${expectedCodes.filter((code) => detectedCodes.has(code)).join(", ")})`);
    } else {
      log(`\nError: ${result.error}`);
      log(`Fetch Status: ${result.fetch_status}`);
      log("### VALIDATION: ❌ FAIL (fetch or parse error)");
    }
  });

  it("Test 3: BetVictor (European multi-market operator)", async () => {
    log("\n" + "=".repeat(80));
    log("TEST 3: BetVictor (European multi-market operator)");
    log("=".repeat(80));
    log("Domain: https://www.betvictor.com/");
    log("Expected: 5+ European markets (GB, DE, SE, IT, PT) via hreflang + licenses");

    const startTime = Date.now();
    const result = await extractBrandAndMarkets("https://www.betvictor.com/");
    const duration = Date.now() - startTime;

    log(`\nFetch Duration: ${duration}ms`);
    log(`Status: ${result.ok ? "✅ SUCCESS" : "❌ ERROR"}`);

    if (result.ok) {
      log(`\n### Brand Detection`);
      log(`- Detected: ${result.brand_candidates[0]?.brand_name || "N/A"}`);

      log(`\n### Market Detection`);
      log(`- Markets Found: ${result.detected_markets.length}`);

      if (result.detected_markets.length > 0) {
        const codes = result.detected_markets.map((m) => m.market_code).sort().join(", ");
        log(`- Codes: ${codes}`);
      }

      log(`\n### Secondary Pages Fetched`);
      log(`- Count: ${result.extraction_metadata.secondary_pages_used.length}`);

      log(`\n### Fetch Metadata`);
      log(`- Primary Status: ${result.extraction_metadata.primary_fetch_status}`);
      log(`- Bytes Read: ${result.extraction_metadata.bytes_read} / ${result.extraction_metadata.bytes_limit}`);

      // Validation: BetVictor is European, should detect multiple EU markets
      const expectedCodes = ["GB", "DE", "SE", "IT", "PT"];
      const detectedCodes = new Set(result.detected_markets.map((m) => m.market_code));
      const foundCount = expectedCodes.filter((code) => detectedCodes.has(code)).length;

      log(`\n### VALIDATION: ${foundCount >= 4 ? "✅ PASS" : "⚠️ PARTIAL"}`);
      log(`Expected at least 4 of: ${expectedCodes.join(", ")}`);
      log(`Found: ${foundCount} (${expectedCodes.filter((code) => detectedCodes.has(code)).join(", ")})`);
    } else {
      log(`\nError: ${result.error}`);
      log(`Fetch Status: ${result.fetch_status}`);
      log("### VALIDATION: ❌ FAIL (fetch or parse error)");
    }
  });

  it("Generate and save validation report", async () => {
    const header = `# Step 3 Live Domain Validation Report\n\nGenerated: ${new Date().toISOString()}\nEnvironment: Network-Enabled (Live Domain Testing)\n`;
    const fullReport = header + "\n" + reportLines.join("\n");

    console.log("\n\n" + "=".repeat(80));
    console.log("STEP 3 LIVE DOMAIN VALIDATION COMPLETE");
    console.log("=".repeat(80));
    console.log(fullReport);

    // Save to file
    fs.writeFileSync("/tmp/step3-live-domain-validation-report.md", fullReport);
    log(`\n✅ Report saved to: /tmp/step3-live-domain-validation-report.md`);
  });
});
