// Scan module task keys — client/server-safe mirror of the Edge contract
// (supabase/functions/_shared/contracts.ts MVP_MODULES). Keep in sync; the
// Agent Control per-module kill switches and API validation use this list.

export const MVP_MODULES = [
  "traffic_seo",
  "geo_aeo",
  "tech_stack",
  "app_store",
  "customer",
  "regulatory",
  "promotions",
  "hiring",
] as const;

export type ModuleTask = (typeof MVP_MODULES)[number];

export const MODULE_LABEL: Record<ModuleTask, string> = {
  traffic_seo: "Traffic & SEO",
  geo_aeo: "GEO / AI visibility",
  tech_stack: "Tech stack",
  app_store: "App store",
  customer: "Customer intel",
  regulatory: "Regulatory",
  promotions: "Promotions",
  hiring: "Hiring signals",
};
