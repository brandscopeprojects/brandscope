"use client";

// OnboardingWizard — the brand-setup wizard (Screen 1, /onboarding), matching
// the approved onboarding mockup: left rail with the wordmark + vertical step
// list ("Step N of 5 · Let's set up your intelligence engine"), a main card
// asking ONE question per screen with a single Continue →, the scan info note,
// and the "Why we need this" checklist. Step 5 (Scanning) is the dark
// /onboarding/scanning page; the rail shows it as the final step.
// Submits via `completeOnboarding`; auto-detection via `detectBrand`.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextInput } from "./TextInput";
import { AutoDetectInput } from "./AutoDetectInput";
import { MarketPicker } from "./MarketPicker";
import { CompetitorList, type CompetitorEntry } from "./CompetitorList";
import { PrimaryButton } from "./PrimaryButton";
import {
  INDUSTRIES,
  COMPETITOR_DEFAULT_COUNT,
  COMPETITOR_MAX,
} from "@/lib/onboarding/constants";
import {
  completeOnboarding,
  detectBrand,
  suggestOnboarding,
} from "@/app/onboarding/actions";

// Rail steps per the mockup (Scanning is the /onboarding/scanning page).
const RAIL_STEPS = ["Brand Domain", "Market", "Industry", "Competitors", "Scanning"];
const SCREEN_COUNT = 4; // screens 0–3 live here; 4 = the scanning page

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

function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full bg-cobalt" aria-hidden />
      <span className="font-display text-lg font-bold tracking-tight text-ink">
        Brandscope
      </span>
    </span>
  );
}

/** Left rail: wordmark, step-of-5 heading, vertical step list (mockup panel 1). */
function StepRail({ current }: { current: number }) {
  return (
    <div className="rounded-card bg-card p-6 shadow-sh1">
      <Wordmark />
      <p className="mt-6 text-xs text-ink-faint">Step {current + 1} of {RAIL_STEPS.length}</p>
      <p className="mt-1 text-sm font-semibold leading-snug text-ink">
        Let&rsquo;s set up your intelligence engine
      </p>
      <ol className="mt-6 flex flex-col">
        {RAIL_STEPS.map((label, i) => {
          const isActive = i === current;
          const isDone = i < current;
          return (
            <li key={label} className="flex items-stretch gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isActive
                      ? "bg-cobalt text-white"
                      : isDone
                        ? "bg-cobalt/15 text-cobalt"
                        : "bg-base-secondary text-ink-faint",
                  ].join(" ")}
                >
                  {isDone ? "✓" : i + 1}
                </span>
                {i < RAIL_STEPS.length - 1 && (
                  <span
                    className={[
                      "w-px flex-1 min-h-[18px]",
                      isDone ? "bg-cobalt/30" : "bg-divider",
                    ].join(" ")}
                    aria-hidden
                  />
                )}
              </div>
              <span
                className={[
                  "pb-4 pt-1 text-sm",
                  isActive
                    ? "font-medium text-cobalt"
                    : isDone
                      ? "text-ink"
                      : "text-ink-faint",
                ].join(" ")}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** "Why we need this" checklist (mockup panel 1, bottom-left). */
function WhyCard() {
  const points = [
    "Track your visibility across markets",
    "Monitor competitor positioning",
    "Generate actionable recommendations",
  ];
  return (
    <div className="rounded-card bg-card p-5 shadow-sh1">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        Why we need this
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-ink-secondary">
            <span className="mt-0.5 text-cobalt" aria-hidden>✓</span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OnboardingWizard({ initialDomain = "" }: { initialDomain?: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1 — brand domain (+ auto-detected name)
  const [brandDomain, setBrandDomain] = useState(initialDomain);
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

  // Setup agent (onboarding-suggest): detected territory + suggested competitors.
  // Fires in the background when the user leaves the domain step; everything it
  // fills stays fully editable. User edits always win over late suggestions.
  const [suggestedMarkets, setSuggestedMarkets] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [competitorsPrefilled, setCompetitorsPrefilled] = useState(false);
  const marketsTouched = useRef(false);
  const competitorsTouched = useRef(false);
  const suggestedForDomain = useRef<string | null>(null);

  function runSuggestion(domain: string) {
    const key = domain.trim().toLowerCase();
    if (!key || suggestedForDomain.current === key) return;
    suggestedForDomain.current = key;
    setSuggesting(true);
    suggestOnboarding(domain)
      .then((s) => {
        setSuggestedMarkets(s.markets);
        setBrandName((prev) => (prev.trim() ? prev : (s.name ?? prev)));
        // Pre-select the detected territory unless the user already chose markets.
        if (!marketsTouched.current && s.markets.length > 0) {
          setMarkets(s.markets);
        }
        // Pre-populate competitors only while every row is still blank.
        if (!competitorsTouched.current && s.competitors.length > 0) {
          setCompetitors(
            s.competitors.map((c) => ({
              ...blankRow(),
              domain: c.domain,
              name: c.name,
              tier: c.tier,
            })),
          );
          setCompetitorsPrefilled(true);
        }
      })
      .catch(() => {
        // Best-effort: the wizard works fully manually.
      })
      .finally(() => setSuggesting(false));
  }

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
    marketsTouched.current = true;
    setMarkets((prev) =>
      prev.includes(value) ? prev.filter((m) => m !== value) : [...prev, value],
    );
  }

  function patchCompetitor(id: string, patch: Partial<CompetitorEntry>) {
    competitorsTouched.current = true;
    setCompetitors((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeCompetitor(id: string) {
    competitorsTouched.current = true;
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
  }
  function addCompetitor() {
    competitorsTouched.current = true;
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
    // Leaving the domain step → kick off the setup agent in the background.
    if (step === 0) runSuggestion(brandDomain);
    setStep((s) => Math.min(s + 1, SCREEN_COUNT - 1));
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

  const isLastScreen = step === SCREEN_COUNT - 1;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Mobile: compact step header (rail collapses) */}
      <div className="mb-4 md:hidden">
        <div className="flex items-center justify-between">
          <Wordmark />
          <span className="text-xs text-ink-faint">
            Step {step + 1} of {RAIL_STEPS.length} · {RAIL_STEPS[step]}
          </span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-base-secondary">
          <div
            className="h-full rounded-full bg-cobalt transition-all"
            style={{ width: `${((step + 1) / RAIL_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[260px_minmax(0,1fr)]">
        {/* Left rail + why-card (desktop) */}
        <div className="hidden flex-col gap-5 md:flex">
          <StepRail current={step} />
          <WhyCard />
        </div>

        {/* Main card */}
        <div className="flex flex-col">
          <div className="relative flex min-h-[420px] flex-col rounded-card bg-card p-6 shadow-sh1 md:p-10">
            <a
              href="mailto:support@brandscope.io"
              className="absolute right-5 top-5 text-xs text-ink-faint transition-colors hover:text-ink"
            >
              ? Help
            </a>

            {step === 0 && (
              <div className="my-auto flex w-full max-w-md flex-col gap-5 self-center">
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink">
                    What is your brand&rsquo;s domain?
                  </h2>
                  <p className="mt-2 text-sm text-ink-secondary">
                    This will be used to track your digital presence.
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
                  label="Brand name (auto-detected)"
                  placeholder="Edit if needed"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                />
                <PrimaryButton onClick={next} disabled={!canAdvance()}>
                  Continue →
                </PrimaryButton>
                <div className="rounded-chip bg-base-secondary px-4 py-3 text-xs leading-relaxed text-ink-secondary">
                  We will scan your site and public data sources to build your
                  competitive intelligence.
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="flex w-full flex-col gap-5">
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink">
                    Where do you operate?
                  </h2>
                  <p className="mt-2 text-sm text-ink-secondary">
                    Every African market where iGaming is regulated. Select all
                    markets you compete in (at least one).
                  </p>
                </div>
                {suggesting && (
                  <div className="flex items-center gap-2 rounded-chip bg-base-secondary px-4 py-2.5 text-xs text-ink-secondary">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-cobalt" aria-hidden />
                    Setup agent is scanning {brandDomain || "your site"} to detect
                    your territory…
                  </div>
                )}
                {!suggesting && suggestedMarkets.length > 0 && (
                  <div className="rounded-chip bg-base-secondary px-4 py-2.5 text-xs text-ink-secondary">
                    <span className="font-medium text-cobalt">✦ Detected territory</span>{" "}
                    — highlighted markets were found for {brandName || brandDomain}.
                    Adjust freely.
                  </div>
                )}
                <div className="max-h-[340px] overflow-y-auto pr-1">
                  <MarketPicker
                    selected={markets}
                    onToggle={toggleMarket}
                    suggested={suggestedMarkets}
                  />
                </div>
                <PrimaryButton onClick={next} disabled={!canAdvance()}>
                  Continue →
                </PrimaryButton>
              </div>
            )}

            {step === 2 && (
              <div className="my-auto flex w-full max-w-md flex-col gap-5 self-center">
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink">
                    What&rsquo;s your industry?
                  </h2>
                  <p className="mt-2 text-sm text-ink-secondary">
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
                    className="rounded-chip border border-divider bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-cobalt"
                  >
                    {INDUSTRIES.map((opt) => (
                      <option key={opt.value} value={opt.value} disabled={opt.comingSoon}>
                        {opt.label}
                        {opt.comingSoon ? " (Coming soon)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <PrimaryButton onClick={next} disabled={!canAdvance()}>
                  Continue →
                </PrimaryButton>
              </div>
            )}

            {step === 3 && (
              <div className="flex w-full flex-col gap-5">
                <div>
                  <h2 className="font-display text-2xl font-bold text-ink">
                    Who are your competitors?
                  </h2>
                  <p className="mt-2 text-sm text-ink-secondary">
                    Add up to {COMPETITOR_MAX}. We&rsquo;ll detect each brand&rsquo;s
                    name and tier — edit anything that looks off.
                  </p>
                </div>
                {suggesting && (
                  <div className="flex items-center gap-2 rounded-chip bg-base-secondary px-4 py-2.5 text-xs text-ink-secondary">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-cobalt" aria-hidden />
                    Setup agent is looking for competitors in your market…
                  </div>
                )}
                {!suggesting && competitorsPrefilled && (
                  <div className="rounded-chip bg-base-secondary px-4 py-2.5 text-xs text-ink-secondary">
                    <span className="font-medium text-cobalt">✦ Suggested by the setup agent</span>{" "}
                    from your market — edit, remove, or add your own.
                  </div>
                )}
                <CompetitorList
                  competitors={competitors}
                  onChange={patchCompetitor}
                  onRemove={removeCompetitor}
                  onAdd={addCompetitor}
                  onDetect={detectCompetitor}
                />
                <PrimaryButton onClick={submit} disabled={!canAdvance() || pending}>
                  {pending ? "Setting up…" : "Start first scan →"}
                </PrimaryButton>
              </div>
            )}

            {error && <p className="mt-4 text-sm text-urgent">{error}</p>}
          </div>

          {step > 0 && (
            <button
              type="button"
              onClick={back}
              disabled={pending}
              className="mt-4 self-start text-sm text-ink-secondary transition-colors hover:text-ink"
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      {/* Mobile why-card below the flow */}
      <div className="mt-5 md:hidden">
        <WhyCard />
      </div>
    </div>
  );
}
