// Agent Control Centre (Screen 25, /brandscope-admin/agents).
// Internal-admin only — the layout enforces requireInternalAdmin() and provides
// the dark shell + padded container, so this is content-only. All four source
// tables (agents, agent_skills, agent_job_logs, prompt_versions) are Class-2
// (service-role-only, GLOBAL) and read via createAdminClient in the data layer.
// force-dynamic: traces are live operational data, never cached at build.

import { PageHeader } from "@/components/intelligence/PageHeader";
import { EmptyState } from "@/components/intelligence/EmptyState";
import { AgentsRoster } from "@/components/admin/AgentsRoster";
import { AgentsPromptVersions } from "@/components/admin/AgentsPromptVersions";
import { AgentsJobTrace } from "@/components/admin/AgentsJobTrace";
import { getAgentControlData } from "@/lib/data/internal-agents";

export const dynamic = "force-dynamic";

export default async function AgentControlCentrePage() {
  const { agents, promptVersions, jobTrace, jobTraceTruncated } =
    await getAgentControlData();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agent Control Centre"
        subtitle="The Brandscope agent fleet, their skills, prompt versions and recent job traces."
      />

      {agents.length === 0 ? (
        <EmptyState
          intent="scanning"
          title="No agents registered yet"
          message="Agents appear here once the orchestration pipeline is deployed."
        />
      ) : (
        <>
          <AgentsRoster agents={agents} />
          <AgentsPromptVersions promptVersions={promptVersions} />
          <AgentsJobTrace jobTrace={jobTrace} truncated={jobTraceTruncated} />
        </>
      )}
    </div>
  );
}
