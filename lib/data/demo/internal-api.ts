// DEMO / SAMPLE DATA — Internal admin: API Management (Screen 26,
// /brandscope-admin/api-management). Returned by getInternalApiData when
// NEXT_PUBLIC_DEMO_MODE=true and rendered by the public /preview/internal-api
// route. Explicitly sample data — richly populated so the page is fully visible
// against the #21 API Health / Screen-26 mockup.
//
// Shape matches InternalApiData EXACTLY: `health` is one ApiHealthView per
// external provider (DataForSEO, Anthropic, OpenAI, DetectZeStack, Ideogram) and
// `routerRules` is the model_router_config task→model routing table. Both arrays
// are populated. The `tone` / `statusLabel` / `circuit` fields are pre-derived
// exactly as the live statusTone() / circuitState() mappers would derive them,
// so the demo data is internally consistent with the real data layer.
//
// NOTE: there is NO cost table in this schema — none is invented here.
// One provider is intentionally degraded (Ideogram, elevated latency + 6.2%
// error rate → amber, half-open circuit) so the warn/half-open states are
// visible; the rest are healthy/closed.

import type { InternalApiData } from "@/lib/data/internal-api";

// A fixed "now" so the relative "last checked" reads consistently in the demo.
const CHECKED_AT = "2025-05-12T08:55:00.000Z";
const CHECKED_AT_OLDER = "2025-05-12T08:54:00.000Z";

export const DEMO_INTERNAL_API: InternalApiData = {
  health: [
    {
      id: "demo-health-anthropic",
      provider: "Anthropic",
      status: "healthy",
      tone: "good",
      statusLabel: "Healthy",
      latencyMs: 842,
      errorRate24h: 0.2,
      creditBalance: 1840,
      creditCurrency: "USD",
      errorMessage: null,
      checkedAt: CHECKED_AT,
      circuit: "closed",
    },
    {
      id: "demo-health-dataforseo",
      provider: "DataForSEO",
      status: "healthy",
      tone: "good",
      statusLabel: "Healthy",
      latencyMs: 318,
      errorRate24h: 0,
      creditBalance: 4250,
      creditCurrency: "USD",
      errorMessage: null,
      checkedAt: CHECKED_AT,
      circuit: "closed",
    },
    {
      id: "demo-health-detectzestack",
      provider: "DetectZeStack",
      status: "healthy",
      tone: "good",
      statusLabel: "Healthy",
      latencyMs: 1204,
      errorRate24h: 1.1,
      creditBalance: 920,
      creditCurrency: "USD",
      errorMessage: null,
      checkedAt: CHECKED_AT_OLDER,
      circuit: "closed",
    },
    {
      id: "demo-health-ideogram",
      provider: "Ideogram",
      status: "degraded",
      tone: "warn",
      statusLabel: "Degraded",
      latencyMs: 6380,
      errorRate24h: 6.2,
      creditBalance: 310,
      creditCurrency: "USD",
      errorMessage: "Upstream latency elevated — image generation queue backed up",
      checkedAt: CHECKED_AT,
      circuit: "half-open",
    },
    {
      id: "demo-health-openai",
      provider: "OpenAI",
      status: "healthy",
      tone: "good",
      statusLabel: "Healthy",
      latencyMs: 596,
      errorRate24h: 0.4,
      creditBalance: 2705,
      creditCurrency: "USD",
      errorMessage: null,
      checkedAt: CHECKED_AT,
      circuit: "closed",
    },
  ],
  routerRules: [
    {
      id: "demo-router-asset-generation",
      taskType: "asset_generation",
      primaryModel: "claude-sonnet-4-6",
      fallbackModel: "claude-haiku-4-5",
      isActive: true,
      circuitBreakerThresholdPct: 15,
      maxTokens: 8192,
      requestsPerMin: 60,
    },
    {
      id: "demo-router-chat",
      taskType: "chat",
      primaryModel: "gpt-4.1-mini",
      fallbackModel: "claude-haiku-4-5",
      isActive: true,
      circuitBreakerThresholdPct: 15,
      maxTokens: 4096,
      requestsPerMin: 120,
    },
    {
      id: "demo-router-content-analysis",
      taskType: "content_analysis",
      primaryModel: "claude-sonnet-4-6",
      fallbackModel: "gpt-4.1-mini",
      isActive: true,
      circuitBreakerThresholdPct: 20,
      maxTokens: 16000,
      requestsPerMin: 30,
    },
    {
      id: "demo-router-embeddings",
      taskType: "embeddings",
      primaryModel: "text-embedding-3-small",
      fallbackModel: null,
      isActive: true,
      circuitBreakerThresholdPct: 10,
      maxTokens: null,
      requestsPerMin: 200,
    },
    {
      id: "demo-router-extraction",
      taskType: "extraction",
      primaryModel: "gpt-4.1-mini",
      fallbackModel: "claude-haiku-4-5",
      isActive: true,
      circuitBreakerThresholdPct: 15,
      maxTokens: 4096,
      requestsPerMin: 90,
    },
    {
      id: "demo-router-geo-monitoring",
      taskType: "geo_monitoring",
      primaryModel: "dataforseo-ai-optimization",
      fallbackModel: null,
      isActive: true,
      circuitBreakerThresholdPct: 25,
      maxTokens: null,
      requestsPerMin: 15,
    },
    {
      id: "demo-router-image-generation",
      taskType: "image_generation",
      primaryModel: "ideogram-v2",
      fallbackModel: null,
      isActive: false,
      circuitBreakerThresholdPct: 15,
      maxTokens: null,
      requestsPerMin: 20,
    },
    {
      id: "demo-router-summarisation",
      taskType: "summarisation",
      primaryModel: "claude-haiku-4-5",
      fallbackModel: "gpt-4.1-mini",
      isActive: true,
      circuitBreakerThresholdPct: 15,
      maxTokens: 2048,
      requestsPerMin: 60,
    },
  ],
};
