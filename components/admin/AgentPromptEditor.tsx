"use client";

// AgentPromptEditor — "Prompt Studio" (Screen 25, P2c). Edit any agent prompt
// slot: view the ACTIVE text (DB override, else the code template), save edits
// as a new DRAFT version, test it in the sandbox, Activate (warn-don't-block if
// untested — owner decision), and roll back by activating any prior version.
// Placeholders like {{brand_name}} must be preserved — they interpolate at run
// time. Edge functions pick up an activation within ~5 minutes; fallback is
// always the code template, so a bad row can never take a scan down.

import { useCallback, useEffect, useState, useTransition } from "react";
import { AlertTriangle, Check, FlaskConical, History as HistoryIcon, Rocket } from "lucide-react";
import { SLOT_OPTIONS } from "@/lib/agent-control-shared";

type Version = {
  id: string;
  version: string;
  status: string;
  notes: string | null;
  deployedAt: string | null;
  createdAt: string;
  isPointer: boolean;
  text: string;
};

type SandboxResult = {
  output: string;
  checks: { jsonValid: boolean; canaryLeaked: boolean | null; promptLeaked: boolean; passed: boolean };
};

export function AgentPromptEditor() {
  const [slot, setSlot] = useState(SLOT_OPTIONS[0].slot);
  const [versions, setVersions] = useState<Version[]>([]);
  const [codeTpl, setCodeTpl] = useState<string>("");
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState<SandboxResult | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(async (s: string) => {
    setMessage(null);
    setSandbox(null);
    const res = await fetch(`/api/agent-control/prompts?slot=${encodeURIComponent(s)}`);
    const data = await res.json().catch(() => null);
    if (data?.ok) {
      setVersions(data.versions);
      setCodeTpl(data.codeTemplate ?? "");
      setText(data.activeText ?? data.codeTemplate ?? "");
      setNotes("");
    }
  }, []);
  useEffect(() => {
    void load(slot);
  }, [slot, load]);

  const activeIsDb = versions.some((v) => v.status === "active" && !v.isPointer);

  function saveDraft() {
    start(async () => {
      const res = await fetch("/api/agent-control/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, systemPrompt: text, notes }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      setMessage(data.ok ? `Saved as draft ${data.draft.version}.` : (data.error ?? "Save failed."));
      if (data.ok) void load(slot);
    });
  }

  function activate(id: string) {
    start(async () => {
      const res = await fetch("/api/agent-control/prompts/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        setMessage(data.error ?? "Activate failed.");
        return;
      }
      setMessage(
        data.sandboxTested
          ? "Active — live within ~5 minutes."
          : "⚠ Activated WITHOUT a sandbox test — live within ~5 minutes. Consider testing next time.",
      );
      void load(slot);
    });
  }

  function testInSandbox() {
    start(async () => {
      setSandbox(null);
      const res = await fetch("/api/agent-control/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot, draftText: text, presetId: "ignore-previous" }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok) setSandbox({ output: data.output, checks: data.checks });
      else setMessage(data.error ?? "Sandbox failed.");
    });
  }

  return (
    <section aria-label="Prompt studio" className="space-y-3">
      <h2 className="font-display text-lg font-bold text-ink">Prompt studio</h2>
      <div className="rounded-card bg-card p-4 shadow-sh1">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            aria-label="Prompt slot"
            className="min-h-[40px] min-w-0 flex-1 rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none focus:border-cobalt sm:flex-none"
          >
            {SLOT_OPTIONS.map((o) => (
              <option key={o.slot} value={o.slot}>
                {o.label}
              </option>
            ))}
          </select>
          <span
            className={[
              "rounded-full px-2.5 py-1 text-[11px] font-medium",
              activeIsDb ? "bg-cobalt/10 text-cobalt" : "bg-base-secondary text-ink-faint",
            ].join(" ")}
          >
            {activeIsDb ? "DB override active" : "running code template"}
          </span>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          spellCheck={false}
          aria-label="System prompt"
          className="mt-3 w-full rounded-card border border-divider bg-base-secondary/40 p-3 font-mono text-xs leading-5 text-ink outline-none focus:border-cobalt"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Change note (optional)"
            className="min-h-[36px] min-w-0 flex-1 rounded-chip border border-divider bg-card px-3 py-1.5 text-xs text-ink outline-none placeholder:text-ink-faint focus:border-cobalt"
          />
          <button
            type="button"
            onClick={() => setText(codeTpl)}
            className="rounded-chip border border-divider px-3 py-1.5 text-xs text-ink-secondary hover:text-ink"
          >
            Reset to code
          </button>
          <button
            type="button"
            onClick={testInSandbox}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-chip border border-cobalt px-3 py-1.5 text-xs font-medium text-cobalt disabled:opacity-50"
          >
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            Test (red-team)
          </button>
          <button
            type="button"
            onClick={saveDraft}
            disabled={pending || text.trim().length < 40}
            className="rounded-chip bg-cobalt px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Working…" : "Save draft"}
          </button>
        </div>

        {message && <p className="mt-2 text-xs text-ink-secondary">{message}</p>}

        {sandbox && (
          <div className="mt-3 rounded-card bg-base-secondary/50 p-3">
            <div className="flex flex-wrap gap-1.5">
              <CheckBadge ok={sandbox.checks.jsonValid} label="JSON contract" />
              <CheckBadge ok={sandbox.checks.canaryLeaked !== true} label="Injection resisted" />
              <CheckBadge ok={!sandbox.checks.promptLeaked} label="No prompt leak" />
            </div>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-4 text-ink-secondary">
              {sandbox.output}
            </pre>
          </div>
        )}

        {/* ── Version history ── */}
        <div className="mt-4 border-t border-divider pt-3">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            <HistoryIcon className="h-3.5 w-3.5" aria-hidden /> Versions
          </p>
          <ul className="mt-2 space-y-1.5">
            {versions.length === 0 && (
              <li className="text-xs text-ink-faint">No DB versions yet — the code template runs.</li>
            )}
            {versions.map((v) => (
              <li key={v.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-ink">{v.version}</span>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    v.status === "active"
                      ? "bg-opportunity/10 text-opportunity"
                      : v.status === "draft"
                        ? "bg-cobalt/10 text-cobalt"
                        : "bg-base-secondary text-ink-faint",
                  ].join(" ")}
                >
                  {v.isPointer ? "code pointer" : v.status}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-faint">{v.notes ?? ""}</span>
                {!v.isPointer && v.status !== "active" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setText(v.text)}
                      className="text-[11px] text-ink-secondary underline-offset-2 hover:underline"
                    >
                      load
                    </button>
                    <button
                      type="button"
                      onClick={() => activate(v.id)}
                      disabled={pending}
                      className="flex items-center gap-1 rounded-chip bg-cobalt/10 px-2 py-0.5 text-[11px] font-medium text-cobalt disabled:opacity-50"
                    >
                      <Rocket className="h-3 w-3" aria-hidden /> Activate
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-ink-faint">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            Rollback = activate a previous version. Keep {"{{placeholders}}"} intact — they
            interpolate at run time. If a DB prompt ever misbehaves, the code template is the
            permanent fail-safe.
          </p>
        </div>
      </div>
    </section>
  );
}

function CheckBadge({ ok, label }: { ok: boolean; label: string }) {
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
