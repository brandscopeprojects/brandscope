"use client";

// AgentsRoster — the Brandscope agent fleet (Screen 25, internal admin §11.3).
// One card per agent: identity, status, model, prompt version, skills, and the
// Declared/Observed AgentConfigPanel. EDITABLE since P2c: the status pill is a
// real KILL SWITCH (agents.status, enforced by brand-scan/synthesis/cron), the
// Researcher card carries per-module switches (agents.config.disabled_modules),
// and skill chips toggle agent_skills.is_active (registry metadata only —
// execution gating is the kill switch / module switches).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { StatusPill } from "@/components/intelligence/StatusPill";
import { AgentConfigPanel } from "./AgentConfigPanel";
import { MVP_MODULES, MODULE_LABEL, type ModuleTask } from "@/lib/onboarding/module-tasks";
import type { AgentView } from "@/lib/data/internal-agents";

async function patchAgent(body: Record<string, unknown>): Promise<boolean> {
  const res = await fetch("/api/agent-control/agent", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({ ok: false }))).ok === true;
}

function KillSwitch({ agent }: { agent: AgentView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const paused = agent.status === "inactive";

  function toggle() {
    const warning = paused
      ? `Resume the ${agent.displayName} agent?`
      : agent.name === "supervisor"
        ? "Pause the Supervisor? The WHOLE weekly scan stops until resumed."
        : agent.name === "researcher"
          ? "Pause the Researcher? ALL intelligence modules are skipped until resumed."
          : `Pause ${agent.displayName}? Synthesis is skipped (jobs finish as partial) until resumed.`;
    if (!window.confirm(warning)) return;
    start(async () => {
      if (await patchAgent({ name: agent.name, status: paused ? "active" : "inactive" })) {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={paused ? "Resume agent" : "Pause agent (kill switch)"}
      className={[
        "flex min-h-[32px] items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
        paused
          ? "bg-urgent/10 text-urgent hover:bg-urgent/20"
          : "bg-opportunity/10 text-opportunity hover:bg-opportunity/20",
      ].join(" ")}
    >
      {paused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />}
      {paused ? "Paused" : "Active"}
    </button>
  );
}

function ModuleSwitches({ agent }: { agent: AgentView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [disabled, setDisabled] = useState<string[]>(agent.disabledModules ?? []);

  function toggle(task: ModuleTask) {
    const next = disabled.includes(task) ? disabled.filter((t) => t !== task) : [...disabled, task];
    const prev = disabled;
    setDisabled(next); // optimistic
    start(async () => {
      const ok = await patchAgent({ name: "researcher", disabledModules: next });
      if (!ok) setDisabled(prev);
      else router.refresh();
    });
  }

  return (
    <div className="mt-3">
      <p className="text-[11px] text-ink-secondary">
        Module switches{" "}
        <span className="text-ink-faint">(paused modules are skipped next scan)</span>
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {MVP_MODULES.map((task) => {
          const off = disabled.includes(task);
          return (
            <li key={task}>
              <button
                type="button"
                onClick={() => toggle(task)}
                disabled={pending}
                className={[
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60",
                  off
                    ? "bg-urgent/10 text-urgent line-through"
                    : "bg-base-secondary text-ink-secondary hover:text-ink",
                ].join(" ")}
              >
                {MODULE_LABEL[task]}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SkillChip({ skill }: { skill: AgentView["skills"][number] }) {
  const [active, setActive] = useState(skill.isActive);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Toggle skill (registry metadata)"
      onClick={() =>
        start(async () => {
          const next = !active;
          setActive(next);
          const res = await fetch("/api/agent-control/skill", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: skill.id, isActive: next }),
          });
          if (!(await res.json().catch(() => ({ ok: false }))).ok) setActive(!next);
        })
      }
      className={[
        "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60",
        active
          ? "bg-base-secondary text-ink-secondary"
          : "bg-base-secondary/50 text-ink-faint line-through",
      ].join(" ")}
    >
      {skill.name}
    </button>
  );
}

export function AgentsRoster({ agents }: { agents: AgentView[] }) {
  return (
    <section aria-label="Agent fleet" className="space-y-3">
      <h2 className="font-display text-lg font-bold text-ink">Agent fleet</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <article key={agent.id} className="flex flex-col rounded-card bg-card p-4 shadow-sh1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-display text-base font-bold text-ink">
                  {agent.displayName}
                </h3>
                <p className="truncate font-mono text-[11px] text-ink-faint">{agent.name}</p>
              </div>
              {agent.status === "error" ? (
                <StatusPill label="Error" tone={agent.statusTone} />
              ) : (
                <KillSwitch agent={agent} />
              )}
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
                    <li key={skill.id}>
                      <SkillChip skill={skill} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {agent.name === "researcher" && <ModuleSwitches agent={agent} />}

            {agent.config && <AgentConfigPanel config={agent.config} />}
          </article>
        ))}
      </div>
    </section>
  );
}
