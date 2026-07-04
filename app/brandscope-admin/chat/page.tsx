// Internal admin — HQ Chat (owner-approved 2026-07; registry #329 built as a
// v2 tool-calling agent). Dark shell + requireInternalAdmin come from the
// internal-admin layout; the API route re-checks the role (defense in depth).
// The agent answers founder/management questions grounded in internal tables
// (brands, revenue, operations, agent telemetry, users) and is honest about
// modules that don't exist yet (marketing, CRM, CMS — see docs/backlog.md).

import { PageHeader } from "@/components/intelligence/PageHeader";
import { HqChat } from "@/components/admin/HqChat";

export const dynamic = "force-dynamic";

export default function HqChatPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="HQ Chat"
        subtitle="Your operations copilot — grounded in live internal data, cites its sources."
      />
      <HqChat />
    </div>
  );
}
