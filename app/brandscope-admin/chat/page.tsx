// Internal admin — HQ Agent (OpenAI text + realtime voice). The dark shell +
// requireInternalAdmin come from the internal-admin layout; every /api/hq-agent
// route re-checks the role (defense in depth). The agent answers management
// questions grounded in live internal data through the approved server-side tool
// registry, and is honest when a data source isn't available. Configuration lives
// at /brandscope-admin/settings.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { HqAgentShell } from "@/components/hq-agent/hq-agent-shell";

export const dynamic = "force-dynamic";

export default function HqAgentPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="HQ Agent"
        subtitle="Internal executive intelligence — live answers across customers, revenue, operations and AI usage."
      />
      <HqAgentShell />
    </div>
  );
}
