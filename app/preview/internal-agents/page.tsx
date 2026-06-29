// Public design preview of the Internal Agent Control Centre (Screen 25),
// populated with the synthetic DEMO_INTERNAL_AGENTS dataset. No auth/Supabase —
// renders the SAME AgentsRoster / AgentsPromptVersions / AgentsJobTrace
// components inside the InternalShell so the internal-admin visual language
// (dark sidebar, data-dense, table-heavy §11.3) is visible. Sample data only.

import { InternalShell } from "@/components/admin/InternalShell";
import { PageHeader } from "@/components/intelligence/PageHeader";
import { AgentsRoster } from "@/components/admin/AgentsRoster";
import { AgentsPromptVersions } from "@/components/admin/AgentsPromptVersions";
import { AgentsJobTrace } from "@/components/admin/AgentsJobTrace";
import { DEMO_INTERNAL_AGENTS } from "@/lib/data/demo/internal-agents";

export const dynamic = "force-dynamic";

export default function PreviewInternalAgents() {
  const { agents, promptVersions, jobTrace, jobTraceTruncated } =
    DEMO_INTERNAL_AGENTS;

  return (
    <InternalShell operatorEmail="ops@brandscope.io" isSuperAdmin={true}>
      <div className="space-y-8">
        <PageHeader
          title="Agent Control Centre"
          subtitle="The Brandscope agent fleet, their skills, prompt versions and recent job traces."
        />
        <AgentsRoster agents={agents} />
        <AgentsPromptVersions promptVersions={promptVersions} />
        <AgentsJobTrace jobTrace={jobTrace} truncated={jobTraceTruncated} />
      </div>
    </InternalShell>
  );
}
