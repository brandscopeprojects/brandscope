"use client";

// AgentConfigPanel — expandable "Configuration" section on each Agent Control
// card (backlog P2c Phase A item 1). Two columns: DECLARED (each field read from
// where it is enforced — the live model router, or the committed manifest
// generated from function source) and OBSERVED (what recent runs actually used,
// from agent_job_logs). Amber drift badge when they disagree. Read-only by
// design: editing happens only where safe write paths exist (router table;
// kill switch and prompt versions arrive later in Phase A/B).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { APPROVED_MODELS } from "@/lib/agent-control-shared";
import type { AgentConfigView } from "@/lib/data/internal-agents";

// Local copies of the tiny formatters — lib/data/internal-agents is server-only
// and must not enter the client bundle.
function formatLatencyMs(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  return `${Math.round(ms).toLocaleString("en-GB")} ms`;
}
function formatCostUsd(usd: number | null | undefined): string {
  if (usd == null || Number.isNaN(usd)) return "—";
  const dp = usd !== 0 && Math.abs(usd) < 0.1 ? 4 : 2;
  return `$${usd.toFixed(dp)}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-[11px] text-ink-faint">{label}</dt>
      <dd className="min-w-0 text-right font-mono text-[11px] text-ink">{children}</dd>
    </div>
  );
}

const codeTag = (
  <span className="ml-1 rounded-full bg-base-secondary px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-ink-faint">
    code
  </span>
);

export function AgentConfigPanel({ config }: { config: AgentConfigView }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const { declared, observed, drift } = config;

  return (
    <div className="mt-3 border-t border-divider pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-chip px-1 py-1 text-left text-xs font-medium text-ink-secondary transition-colors hover:text-ink"
      >
        <span className="flex items-center gap-2">
          Configuration
          {drift.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-urgent/10 px-2 py-0.5 text-[10px] font-semibold text-urgent">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              drift
            </span>
          )}
        </span>
        <ChevronDown
          className={["h-4 w-4 transition-transform", open ? "rotate-180" : ""].join(" ")}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {drift.length > 0 && (
              <ul className="mt-2 space-y-1 rounded-card bg-urgent/5 p-2.5">
                {drift.map((d) => (
                  <li key={d} className="flex items-start gap-1.5 text-[11px] leading-4 text-urgent">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    {d}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* ── Declared ── */}
              <dl className="rounded-card bg-base-secondary/50 p-2.5">
                <p className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                  Declared
                </p>
                {declared.routerRules.map((r) => (
                  <RouterRuleEditor key={r.task} rule={r} />
                ))}
                {declared.routerRules.length === 0 && (
                  <Row label="model">none (deterministic)</Row>
                )}
                {declared.promptVersions.length > 0 && (
                  <Row label="prompt versions">
                    {declared.promptVersions.join(", ")}
                    {codeTag}
                  </Row>
                )}
                {declared.temperatures.length > 0 && (
                  <Row label="temperature">
                    {declared.temperatures.join(" / ")}
                    {codeTag}
                  </Row>
                )}
                {declared.maxTokens.length > 0 && (
                  <Row label="max tokens">
                    {declared.maxTokens.join(" / ")}
                    {codeTag}
                  </Row>
                )}
                {declared.retryDelaysMs && (
                  <Row label="retries">
                    2 × backoff {declared.retryDelaysMs.join("/")}ms{codeTag}
                  </Row>
                )}
                {declared.moduleBudgetMs && (
                  <Row label="time budget">{declared.moduleBudgetMs / 1000}s{codeTag}</Row>
                )}
                {declared.schedule && <Row label="schedule">{declared.schedule}</Row>}
                {declared.providers.length > 0 && (
                  <Row label="providers">{declared.providers.join(", ")}</Row>
                )}
                {declared.gating.length > 0 && (
                  <Row label="gating">
                    {declared.gating
                      .map((g) => `${g.column}${g.disabledBrands ? ` (${g.disabledBrands} off)` : ""}`)
                      .join(", ")}
                  </Row>
                )}
                {declared.dataforseoEndpoints.length > 0 && (
                  <div className="pt-1">
                    <p className="pb-1 text-[11px] text-ink-faint">DataForSEO endpoints</p>
                    <div className="flex flex-wrap gap-1">
                      {declared.dataforseoEndpoints.map((e) => (
                        <span
                          key={e}
                          className="rounded-full bg-card px-2 py-0.5 font-mono text-[10px] text-ink-secondary"
                        >
                          {e.split("/").slice(-2, -1)[0] ?? e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </dl>

              {/* ── Observed ── */}
              <dl className="rounded-card bg-base-secondary/50 p-2.5">
                <p className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                  Observed (recent runs)
                </p>
                {!observed && (
                  <p className="py-2 text-[11px] leading-4 text-ink-faint">
                    No runs yet — populates after the first scan.
                  </p>
                )}
                {observed && (
                  <>
                    <Row label="last model used">{observed.lastModel ?? "—"}</Row>
                    <Row label="last prompt">{observed.lastPromptVersion ?? "—"}</Row>
                    <Row label="runs (recent)">{observed.runs}</Row>
                    <Row label="failure rate">
                      {observed.runs > 0
                        ? `${Math.round((observed.failures / observed.runs) * 100)}%`
                        : "—"}
                    </Row>
                    <Row label="avg duration">{formatLatencyMs(observed.avgDurationMs)}</Row>
                    <Row label="avg cost / run">{formatCostUsd(observed.avgCostUsd)}</Row>
                    <Row label="last run">
                      {observed.lastRunAt
                        ? new Date(observed.lastRunAt).toLocaleString()
                        : "—"}
                    </Row>
                  </>
                )}
              </dl>
            </div>

            <p className="pt-2 text-[10px] text-ink-faint">
              Declared values come from the live model router and a manifest generated
              from function source ({new Date(declared.manifestGeneratedAt).toLocaleDateString()}).
              Code-tagged fields change via deploy; model/temperature/max-tokens are LIVE edits (router picks them up within ~5 minutes).
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Editable router rule (model picker locked to the approved list; bounded
// temperature slider + max-tokens; null = code default). Live within ~5 min. ──
function RouterRuleEditor({
  rule,
}: {
  rule: { task: string; primaryModel: string; fallbackModel: string | null; temperature: number | null; maxTokens: number | null };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [primary, setPrimary] = useState(rule.primaryModel);
  const [temp, setTemp] = useState<number | null>(rule.temperature);
  const [tokens, setTokens] = useState<number | null>(rule.maxTokens);
  const [saved, setSaved] = useState(false);

  const dirty =
    primary !== rule.primaryModel || temp !== rule.temperature || tokens !== rule.maxTokens;

  function save() {
    start(async () => {
      const res = await fetch("/api/agent-control/router", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: rule.task,
          primaryModel: primary,
          temperature: temp,
          maxTokens: tokens,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-1.5 border-b border-divider py-2 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-ink-faint">model · {rule.task}</span>
        <select
          value={primary}
          onChange={(e) => setPrimary(e.target.value)}
          aria-label={`Model for ${rule.task}`}
          className="min-h-[32px] rounded-chip border border-divider bg-card px-2 py-1 font-mono text-[11px] text-ink outline-none focus:border-cobalt"
        >
          {APPROVED_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-[11px] text-ink-faint">temperature</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={temp ?? 0.3}
          onChange={(e) => setTemp(Number(e.target.value))}
          aria-label={`Temperature for ${rule.task}`}
          className="min-w-0 flex-1 accent-cobalt"
        />
        <span className="w-12 text-right font-mono text-[11px] text-ink">
          {temp == null ? "code" : temp.toFixed(2)}
        </span>
        {temp != null && (
          <button
            type="button"
            onClick={() => setTemp(null)}
            className="text-[10px] text-ink-faint underline-offset-2 hover:underline"
            title="Use the code default"
          >
            reset
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-[11px] text-ink-faint">max tokens</span>
        <input
          type="number"
          min={100}
          max={4000}
          step={50}
          value={tokens ?? ""}
          placeholder="code default"
          onChange={(e) => setTokens(e.target.value === "" ? null : Number(e.target.value))}
          aria-label={`Max tokens for ${rule.task}`}
          className="min-h-[32px] w-28 rounded-chip border border-divider bg-card px-2 py-1 font-mono text-[11px] text-ink outline-none placeholder:text-ink-faint focus:border-cobalt"
        />
        <span className="flex-1" />
        {saved && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-opportunity">
            <Check className="h-3 w-3" aria-hidden /> live in ≤5 min
          </span>
        )}
        {dirty && (
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-chip bg-cobalt px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}
