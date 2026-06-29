"use client";

// AdminCompetitorsAddForm — the "Add competitor" form for Screen 21.
// Domain + name + tier select; calls the parent's onAdd (which wraps the
// addCompetitor server action). Mirrors the onboarding AutoDetectInput look —
// cobalt outline detect button, divider-bordered fields — but is its own admin
// component (per file-ownership rules). Tokens only.

import { useState } from "react";
import { detectBrand } from "@/app/onboarding/actions";
import { COMPETITOR_TIERS } from "@/lib/onboarding/constants";
import type { CompetitorTier } from "@/lib/data/competitor-tier";

type AddInput = { domain: string; name: string; tier: CompetitorTier };

export function AdminCompetitorsAddForm({
  onAdd,
  pending,
}: {
  onAdd: (input: AddInput, onDone: (ok: boolean) => void) => void;
  pending: boolean;
}) {
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [tier, setTier] = useState<CompetitorTier>("challenger");
  const [detecting, setDetecting] = useState(false);

  async function runDetect() {
    if (!domain.trim() || detecting) return;
    setDetecting(true);
    try {
      const detected = await detectBrand(domain);
      setDomain(detected.domain);
      // Only auto-fill the name if the user hasn't typed one.
      if (!name.trim()) setName(detected.name);
      setTier(detected.tier);
    } finally {
      setDetecting(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim() || pending) return;
    onAdd({ domain: domain.trim(), name: name.trim(), tier }, (ok) => {
      if (ok) {
        setDomain("");
        setName("");
        setTier("challenger");
      }
    });
  }

  const disabled = pending || detecting || !domain.trim();

  return (
    <form
      onSubmit={submit}
      className="rounded-card bg-card p-4 shadow-sh1"
      aria-label="Add competitor"
    >
      <p className="mb-3 font-display text-sm font-bold text-ink">Add a competitor</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Domain + detect */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label
            htmlFor="admincomp-domain"
            className="text-sm font-medium text-ink-secondary"
          >
            Domain
          </label>
          <div className="flex items-stretch gap-2">
            <input
              id="admincomp-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onBlur={runDetect}
              placeholder="competitor.com"
              autoComplete="off"
              className="flex-1 rounded-chip border border-divider bg-card px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt"
            />
            <button
              type="button"
              onClick={runDetect}
              disabled={detecting || !domain.trim()}
              className="shrink-0 rounded-chip border border-cobalt px-3 py-2 text-xs font-medium text-cobalt transition-colors hover:bg-cobalt/10 disabled:opacity-50"
            >
              {detecting ? "Detecting…" : "Detect Brand"}
            </button>
          </div>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="admincomp-name"
            className="text-sm font-medium text-ink-secondary"
          >
            Name
          </label>
          <input
            id="admincomp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Auto-filled from domain"
            className="rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt"
          />
        </div>

        {/* Tier */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="admincomp-tier"
            className="text-sm font-medium text-ink-secondary"
          >
            Tier
          </label>
          <select
            id="admincomp-tier"
            value={tier}
            onChange={(e) => setTier(e.target.value as CompetitorTier)}
            className="rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none focus:border-cobalt"
          >
            {COMPETITOR_TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-chip bg-cobalt px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add competitor"}
        </button>
      </div>
    </form>
  );
}
