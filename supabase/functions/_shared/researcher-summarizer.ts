// Researcher Summarizer — lightweight per-module summary generation.
// After a researcher finishes data collection, it calls this to produce a 2-3 sentence
// summary that synthesis-draft-audit uses instead of raw cache dumps. Haiku-based, <5s.

import { callClaude, loggedLlm, parseJsonFromModel } from "./llm.ts";
import { getAgentConfig, SynthesisSummarySchema, type SynthesisSummary } from "./agent-config.ts";
import type { SupabaseClient } from "./supabase.ts";

/**
 * Generate a lightweight per-module synthesis summary.
 * Call this at the end of each researcher's job, before writing the main cache row.
 *
 * @param sb - Supabase client (service-role)
 * @param moduleName - e.g., "SEO / traffic", "GEO / AI visibility"
 * @param cacheContent - The raw cache data / key insights the researcher discovered
 * @param scanJobId - For logging
 * @param brandId - For logging
 * @returns SynthesisSummary or null if generation fails
 */
export async function generateSynthesisSummary(
  sb: SupabaseClient,
  moduleName: string,
  cacheContent: string,
  scanJobId: string,
  brandId: string,
): Promise<SynthesisSummary | null> {
  try {
    const config = await getAgentConfig(sb, "researcher_summarizer");

    const prompt = `You are a synthesis summarizer. Given raw cache data from a researcher module, produce a 2-3 sentence summary for cross-module analysis.

Module: ${moduleName}

Raw cache data (trimmed):
${cacheContent.slice(0, 2000)}

Respond ONLY with JSON (no prose):
{ "status": "threat"|"neutral"|"opportunity", "key_takeaways": ["takeaway1", "takeaway2"], "recommended_angle": "actionable insight" }`;

    const result = await loggedLlm(
      sb,
      {
        scan_job_id: scanJobId,
        brand_id: brandId,
        agent_name: "researcher_summarizer",
        task_type: "researcher_summarizer",
        prompt_version: "researcher_summarizer@v1",
      },
      () =>
        callClaude({
          model: config.model,
          messages: [{ role: "user", content: prompt }],
          maxTokens: config.maxTokens,
          temperature: config.temperature,
          timeoutMs: 15_000,
        }),
    );

    const summary = SynthesisSummarySchema.parse(parseJsonFromModel(result.text));
    return summary;
  } catch (e) {
    // Log the failure but don't crash the researcher — synthesis will work with raw cache if needed.
    console.error(
      `Failed to generate synthesis summary for ${moduleName}:`,
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}
