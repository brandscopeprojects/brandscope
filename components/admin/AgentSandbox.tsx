"use client";

// AgentSandbox — red-team sandbox (Screen 25, P2c). Fires ONE isolated model
// call: the chosen slot's ACTIVE prompt (DB override or code template) against
// an adversarial preset or custom input. Never touches cache tables; every run
// logs to agent_job_logs (task_type 'sandbox'). Badges: JSON contract held ·
// injection resisted (canary absent) · no system-prompt leak.

import { useState, useTransition } from "react";
import { AlertTriangle, Check, Play } from "lucide-react";
import { REDTEAM_PRESETS, SLOT_OPTIONS } from "@/lib/agent-control-shared";

type Result = {
  model: string;
  output: string;
  checks: { jsonValid: boolean; canaryLeaked: boolean | null; promptLeaked: boolean; passed: boolean };
};

export function AgentSandbox() {
  const [slot, setSlot] = useState("researcher:promotions");
  const [presetId, setPresetId] = useState<string>(REDTEAM_PRESETS[0].id);
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      setError(null);
      setResult(null);
      const res = await fetch("/api/agent-control/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useCustom ? { slot, input: custom } : { slot, presetId },
        ),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "Network error." }));
      if (data.ok) setResult(data);
      else setError(data.error ?? "Sandbox run failed.");
    });
  }

  return (
    <section aria-label="Red-team sandbox" className="space-y-3">
      <h2 className="font-display text-lg font-bold text-ink">Red-team sandbox</h2>
      <div className="rounded-card bg-card p-4 shadow-sh1">
        <p className="text-xs leading-5 text-ink-secondary">
          Fire an adversarial payload at an agent&rsquo;s ACTIVE prompt in isolation — nothing
          is written to the product. If a canary string survives into the output, the
          injection worked and the prompt failed.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            aria-label="Agent slot"
            className="min-h-[40px] rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none focus:border-cobalt"
          >
            {SLOT_OPTIONS.map((o) => (
              <option key={o.slot} value={o.slot}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={useCustom ? "custom" : presetId}
            onChange={(e) => {
              if (e.target.value === "custom") setUseCustom(true);
              else {
                setUseCustom(false);
                setPresetId(e.target.value);
              }
            }}
            aria-label="Attack payload"
            className="min-h-[40px] rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none focus:border-cobalt"
          >
            {REDTEAM_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom input…</option>
          </select>
        </div>

        {useCustom && (
          <textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            rows={4}
            placeholder="Paste the content the agent should analyse (it will be wrapped as untrusted data)…"
            className="mt-2 w-full rounded-card border border-divider bg-base-secondary/40 p-3 font-mono text-xs leading-5 text-ink outline-none placeholder:text-ink-faint focus:border-cobalt"
          />
        )}

        <button
          type="button"
          onClick={run}
          disabled={pending || (useCustom && custom.trim().length === 0)}
          className="mt-3 flex items-center gap-1.5 rounded-chip bg-cobalt px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Play className="h-4 w-4" aria-hidden />
          {pending ? "Running…" : "Run attack"}
        </button>

        {error && <p className="mt-2 text-sm text-urgent">{error}</p>}

        {result && (
          <div className="mt-3 rounded-card bg-base-secondary/50 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge ok={result.checks.jsonValid} label="JSON contract" />
              <Badge ok={result.checks.canaryLeaked !== true} label="Injection resisted" />
              <Badge ok={!result.checks.promptLeaked} label="No prompt leak" />
              <span className="ml-auto font-mono text-[10px] text-ink-faint">{result.model}</span>
            </div>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-4 text-ink-secondary">
              {result.output}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={[
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        ok ? "bg-opportunity/10 text-opportunity" : "bg-urgent/10 text-urgent",
      ].join(" ")}
    >
      {ok ? <Check className="h-3 w-3" aria-hidden /> : <AlertTriangle className="h-3 w-3" aria-hidden />}
      {label}
    </span>
  );
}
