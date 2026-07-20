// Screen — Internal-admin HQ Agent Settings, /brandscope-admin/settings.
// The internal-admin layout renders the dark shell, enforces auth and provides the
// padded container — but we re-assert requireInternalAdmin here as the page guard.
// Content-only: PageHeader + the client config screen (§13). The config itself is
// fetched client-side from /api/hq-agent/config (role-gated, service-role backed).

import { PageHeader } from "@/components/intelligence/PageHeader";
import { HqAgentConfigScreen } from "@/components/hq-agent/config/hq-agent-config-screen";
import { requireInternalAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HqAgentSettingsPage() {
  await requireInternalAdmin();

  return (
    <div className="space-y-8">
      <PageHeader
        title="HQ Agent Settings"
        subtitle="Configure the internal executive intelligence assistant."
      />
      <HqAgentConfigScreen />
    </div>
  );
}
