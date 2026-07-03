"use client";

// AdminSettingsForm — brand-admin Settings (Screen 20), brand-profile half.
// Editable name / domain / positioning / primary colour / scan frequency /
// markets, submitting to updateBrandProfile. Inline success+error, pending state
// via useTransition. Tokens only; cobalt reserved for the primary CTA + own-brand
// market chips. Mobile = single column.

import { useState, useTransition } from "react";
import {
  updateBrandProfile,
  type SettingsActionResult,
  type UpdateBrandProfileInput,
} from "@/app/(app)/admin/settings/actions";
import {
  SCAN_FREQUENCIES,
  type ScanFrequency,
} from "@/app/(app)/admin/settings/constants";
import { MARKETS, MARKET_REGIONS } from "@/lib/onboarding/constants";
import { AdminSettingsMarketChips } from "./AdminSettingsMarketChips";

type AdminSettingsFormProps = {
  initial: {
    name: string;
    domain: string;
    positioningStatement: string;
    primaryColour: string;
    logoUrl: string;
    scanFrequency: string;
    markets: string[];
  };
};

const DEFAULT_COLOUR = "#2B5CE6";

export function AdminSettingsForm({ initial }: AdminSettingsFormProps) {
  const [name, setName] = useState(initial.name);
  const [domain, setDomain] = useState(initial.domain);
  const [positioning, setPositioning] = useState(initial.positioningStatement);
  const [primaryColour, setPrimaryColour] = useState(
    initial.primaryColour || DEFAULT_COLOUR,
  );
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [scanFrequency, setScanFrequency] = useState<string>(
    initial.scanFrequency || "weekly",
  );
  const [markets, setMarkets] = useState<string[]>(initial.markets);

  const [result, setResult] = useState<SettingsActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleMarket(value: string) {
    setResult(null);
    setMarkets((prev) =>
      prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value],
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload: UpdateBrandProfileInput = {
      name,
      domain,
      positioningStatement: positioning,
      primaryColour,
      logoUrl,
      scanFrequency,
      markets,
    };
    startTransition(async () => {
      const res = await updateBrandProfile(payload);
      setResult(res);
    });
  }

  return (
    <section className="rounded-card bg-card p-6 shadow-sh1">
      <header className="mb-5">
        <h2 className="font-display text-lg font-bold text-ink">Brand profile</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Your name, domain and positioning. These shape every scan and asset.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Brand name" htmlFor="brand-name">
            <input
              id="brand-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setResult(null);
              }}
              required
              className={inputClass}
            />
          </Field>

          <Field label="Domain" htmlFor="brand-domain" hint="e.g. riversbet.com">
            <input
              id="brand-domain"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                setResult(null);
              }}
              required
              inputMode="url"
              className={`${inputClass} font-mono`}
            />
          </Field>
        </div>

        <Field
          label="Positioning statement"
          htmlFor="brand-positioning"
          hint="One or two lines on how you want to be seen in-market."
        >
          <textarea
            id="brand-positioning"
            value={positioning}
            onChange={(e) => {
              setPositioning(e.target.value);
              setResult(null);
            }}
            rows={3}
            maxLength={500}
            className={`${inputClass} resize-y`}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Primary colour" htmlFor="brand-colour">
            <div className="flex items-center gap-3">
              <input
                id="brand-colour"
                type="color"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(primaryColour)
                    ? primaryColour
                    : DEFAULT_COLOUR
                }
                onChange={(e) => {
                  setPrimaryColour(e.target.value);
                  setResult(null);
                }}
                aria-label="Primary brand colour"
                className="h-10 w-12 cursor-pointer rounded-chip border border-divider bg-card p-1"
              />
              <input
                value={primaryColour}
                onChange={(e) => {
                  setPrimaryColour(e.target.value);
                  setResult(null);
                }}
                aria-label="Primary colour hex value"
                className={`${inputClass} w-32 font-mono uppercase`}
              />
            </div>
          </Field>

          <Field
            label="Scan frequency"
            htmlFor="brand-scan-frequency"
            hint="How often the competitive scan runs."
          >
            <select
              id="brand-scan-frequency"
              value={scanFrequency}
              onChange={(e) => {
                setScanFrequency(e.target.value as ScanFrequency);
                setResult(null);
              }}
              className={inputClass}
            >
              {SCAN_FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label="Logo URL"
          htmlFor="brand-logo"
          hint="Optional. A hosted URL to your logo image."
        >
          <input
            id="brand-logo"
            value={logoUrl}
            onChange={(e) => {
              setLogoUrl(e.target.value);
              setResult(null);
            }}
            inputMode="url"
            placeholder="https://"
            className={`${inputClass} font-mono`}
          />
        </Field>

        <div className="space-y-3">
          <span className="text-sm font-medium text-ink-secondary">Markets</span>
          {MARKET_REGIONS.map((region) => (
            <div key={region}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-faint">
                {region}
              </p>
              <AdminSettingsMarketChips
                options={MARKETS.filter((m) => m.region === region)}
                selected={markets}
                onToggle={toggleMarket}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-chip bg-cobalt px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save profile"}
          </button>
          {result?.ok && (
            <p className="text-sm font-medium text-opportunity" role="status">
              Profile saved.
            </p>
          )}
          {result && !result.ok && (
            <p className="text-sm font-medium text-urgent" role="alert">
              {result.error}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

const inputClass =
  "w-full rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-cobalt";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-secondary">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
