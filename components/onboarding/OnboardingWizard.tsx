"use client";

// OnboardingWizard — the 5-step brand-setup wizard (Screen 1, /onboarding).
// Client component holding wizard state; submits via the `completeOnboarding`
// server action, then redirects to /onboarding/scanning. Auto-detection (brand
// name from domain; competitor name+tier) runs via the `detectBrand` server action.
// Light theme throughout (the scanning screen is the only dark one).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator } from "./StepIndicator";
import { TextInput } from "./TextInput";
import { AutoDetectInput } from "./AutoDetectInput";
import { MultiSelectChips } from "./MultiSelectChips";
import { CompetitorList, type CompetitorEntry } from "./CompetitorList";
import { PrimaryButton } from "./PrimaryButton";
import {
  ONBOARDING_STEPS,
  MARKETS,
  INDUSTRIES,
  COMPETITOR_DEFAULT_COUNT,
  COMPETITOR_MAX,
} from "@/lib/onboarding/constants";
import { completeOnboarding, detectBrand } from "@/app/onboarding/actions";

let rowSeq = 0;
function blankRow(): CompetitorEntry {
  rowSeq += 1;
  return {
    id: `c-${rowSeq}`,
    domain: "",
    name: "",
    tier: "challenger",
    detecting: false,
  };
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1 — brand
  const [brandDomain, setBrandDomain] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandDetecting, setBrandDetecting] = useState(false);

  // Step 2 — markets
  const [markets, setMarkets] = useState<string[]>([]);

  // Step 3 — industry (iGaming pre-selected; others disabled)
  const [industry, setIndustry] = useState("igaming");

  // Step 4 — competitors (seed COMPETITOR_DEFAULT_COUNT empty rows)
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>(() =>
    Array.from({ length: COMPETITOR_DEFAULT_COUNT }, blankRow),
  );

  // ---- handlers ----
  async function detectBrandName(domain: string) {
    if (!domain.trim()) return;
    setBrandDetecting(true);
    try {
      const res = await detectBrand(domain);
      // Only auto-fill the name if the user hasn't typed one.
      setBrandName((prev) => (prev.trim() ? prev : res.name));
    } catch {
      // Detection is best-effort; silently keep manual entry.
    } finally {
      setBrandDetecting(false);
    }
  }

  function toggleMarket(value: string) {
    setMarkets((prev) =>
      prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value],
    );
  }

  function patchCompetitor(id: string, patch: Partial<CompetitorEntry>) {
    setCompetitors((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeCompetitor(id: string) {
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
  }
  function addCompetitor() {
    setCompetitors((prev) =>
      prev.length >= COMPETITOR_MAX ? prev : [...prev, blankRow()],
    );
  }
  async function detectCompetitor(id: string, domain: string) {
    if (!domain.trim()) return;
    patchCompetitor(id, { detecting: true });
    try {
      const res = await detectBrand(domain);
      setCompetitors((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                domain: res.domain,
                name: c.name.trim() ? c.name : res.name,
                tier: res.tier,
                detecting: false,
              }
            : c,
        ),
      );
    } catch {
      patchCompetitor(id, { detecting: false });
    }
  }

  // ---- per-step validation gate ----
  function canAdvance(): boolean {
    switch (step) {
      case 0:
        return brandDomain.trim().length > 0;
      case 1:
        return markets.length >= 1;
      case 2:
        return industry === "igaming";
      case 3:
        return competitors.some((c) => c.domain.trim().length > 0);
      default:
        return true;
    }
  }

  function next() {
    setError(null);
    if (!canAdvance()) return;
    setStep((s) => Math.min(s + 1, ONBOARDING_STEPS.length - 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    setError(null);
    const payload = {
      brandDomain,
      brandName,
      markets,
      industry,
      competitors: competitors
        .filter((c) => c.domain.trim().length > 0)
        .map((c) => ({ domain: c.domain, name: c.name, tier: c.tier })),
    };
    startTransition(async () => {
      const res = await completeOnboarding(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/onboarding/scanning");
    });
  }

  const filledCompetitors = competitors.filter((c) => c.domain.trim().length > 0);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-8">
      <StepIndicator steps={ONBOARDING_STEPS} current={step} />

      <div className="rounded-card border border-divider bg-card p-6 shadow-sh1">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Your brand</h2>
              <p className="text-sm text-ink-secondary">
                Enter your website. We’ll detect your brand name automatically.
              </p>
            </div>
            <AutoDetectInput
              label="Brand domain"
              placeholder="yourbrand.com"
              value={brandDomain}
              detecting={brandDetecting}
              onChange={setBrandDomain}
              onDetect={detectBrandName}
            />
            <TextInput
              label="Brand name"
              placeholder="Auto-detected — edit if needed"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Your markets</h2>
              <p className="text-sm text-ink-secondary">
                Select every market you operate in (at least one).
              </p>
            </div>
            <MultiSelectChips
              options={MARKETS}
              selected={markets}
              onToggle={toggleMarket}
            />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Your industry</h2>
              <p className="text-sm text-ink-secondary">
                iGaming is available now. Other verticals are coming soon.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="industry-select"
                className="text-sm font-medium text-ink-secondary"
              >
                Industry
              </label>
              <select
                id="industry-select"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="rounded-chip border border-divider bg-card px-3 py-2 text-sm text-ink outline-none focus:border-cobalt"
              >
                {INDUSTRIES.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.comingSoon}>
                    {opt.label}
                    {opt.comingSoon ? " (Coming soon)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Your competitors</h2>
              <p className="text-sm text-ink-secondary">
                Add up to {COMPETITOR_MAX}. We’ll detect each brand’s name and tier —
                edit anything that looks off.
              </p>
            </div>
            <CompetitorList
              competitors={competitors}
              onChange={patchCompetitor}
              onRemove={removeCompetitor}
              onAdd={addCompetitor}
              onDetect={detectCompetitor}
            />
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Confirm &amp; start</h2>
              <p className="text-sm text-ink-secondary">
                We’ll set up your workspace and run your first scan.
              </p>
            </div>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-secondary">Brand</dt>
                <dd className="text-ink">
                  {brandName || "—"}{" "}
                  <span className="font-mono text-xs text-ink-faint">
                    {brandDomain}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-secondary">Markets</dt>
                <dd className="text-ink">
                  {markets
                    .map((m) => MARKETS.find((x) => x.value === m)?.label ?? m)
                    .join(", ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-secondary">Industry</dt>
                <dd className="text-ink">
                  {INDUSTRIES.find((i) => i.value === industry)?.label ?? industry}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-secondary">Competitors</dt>
                <dd className="text-ink">{filledCompetitors.length}</dd>
              </div>
            </dl>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-urgent">{error}</p>}
      </div>

      <div className="flex items-center justify-between">
        <PrimaryButton variant="ghost" onClick={back} disabled={step === 0 || pending}>
          Back
        </PrimaryButton>
        {step < ONBOARDING_STEPS.length - 1 ? (
          <PrimaryButton onClick={next} disabled={!canAdvance()}>
            Continue
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={submit} disabled={pending}>
            {pending ? "Setting up…" : "Start first scan"}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
