// AgentsRoster — the Brandscope agent fleet (Screen 25, internal admin §11.3).
// One card per agent: display name + machine name (mono), role/description,
// status (StatusPill), model (mono), current prompt version (mono), and its
// skills rendered as neutral chips (from agent_skills). Data-dense, card-based.
// Presentational. Tokens only.

import { StatusPill } from "@/components/intelligence/StatusPill";
import type { AgentView } from "@/lib/data/internal-agents";

export function AgentsRoster({ agents }: { agents: AgentView[] }) {
  return (
    <section aria-label="Agent fleet" className="space-y-3">
      <h2 className="font-display text-lg font-bold text-ink">Agent fleet</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <article
            key={agent.id}
            className="flex flex-col rounded-card bg-card p-4 shadow-sh1"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-bold text-ink">
                  {agent.displayName}
                </h3>
                <p className="truncate font-mono text-[11px] text-ink-faint">
                  {agent.name}
                </p>
              </div>
              <StatusPill label={statusLabel(agent.status)} tone={agent.statusTone} />
            </div>

            {agent.description && (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-secondary">
                {agent.description}
              </p>
            )}

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
              <div>
                <dt className="text-[11px] text-ink-secondary">Model</dt>
                <dd className="truncate font-mono text-[13px] text-ink" title={agent.model}>
                  {agent.model}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-secondary">Prompt version</dt>
                <dd className="truncate font-mono text-[13px] text-ink">
                  {agent.currentVersion ?? "—"}
                </dd>
              </div>
            </dl>

            <div className="mt-3">
              <p className="text-[11px] text-ink-secondary">Skills</p>
              {agent.skills.length === 0 ? (
                <p className="mt-1 text-sm text-ink-faint">No skills registered.</p>
              ) : (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {agent.skills.map((skill) => (
                    <li
                      key={skill.id}
                      className={[
                        "rounded-chip px-2 py-0.5 text-xs",
                        skill.isActive
                          ? "bg-base-secondary text-ink-secondary"
                          : "bg-base-secondary text-ink-faint line-through",
                      ].join(" ")}
                      title={skill.isActive ? skill.name : `${skill.name} (inactive)`}
                    >
                      {skill.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Title-case a raw status token (e.g. "active" → "Active"). */
function statusLabel(status: string): string {
  if (!status) return "Unknown";
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
