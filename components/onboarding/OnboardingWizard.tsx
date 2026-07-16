"use client";

// OnboardingWizard — the brand-setup wizard (Screen 1, /onboarding), TWO steps
// (owner-approved 2026-07, screen-specs.md):
//   1. Domain  — "What is your brand's domain?" (+ auto-detected name).
//      Continue fires the setup agent (suggestOnboarding) and advances.
//   2. Confirm & Launch — while the agent runs, an Analyzing interstitial
//      (rotating status lines); it resolves into the confirm form: brand name,
//      GLOBAL MarketCombobox (detected markets pre-selected, ✦), CompetitorList
//      prefilled with agent suggestions (incl. detected tier). Everything is
//      editable; user edits always win. Industry is NOT asked — silently
//      'igaming' (single-vertical MVP).
// Submits via `completeOnboarding` → /onboarding/scanning. Animations via
// motion/react, gated behind useReducedMotion.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TextInput } from "./TextInput";
import { AutoDetectInput } from "./AutoDetectInput";
import { MarketCombobox } from "./MarketCombobox";
import { CompetitorList, type CompetitorEntry } from "./CompetitorList";
import { PrimaryButton } from "./PrimaryButton";
import { COMPETITOR_MAX } from "@/lib/onboarding/constants";
import { marketFromDomain } from "@/lib/onboarding/countries";
import {
  completeOnboarding,
  detectBrand,
  suggestOnboarding,
} from "@/app/onboarding/actions";

// Rail steps (Scanning is the /onboarding/scanning page).
const RAIL_STEPS = ["Brand Domain", "Confirm & Launch", "Scanning"];
const SCREEN_COUNT = 2; // screens 0–1 live here; 2 = the scanning page

const ANALYZING_LINES = [
  "Reading your homepage…",
  "Detecting the markets you operate in…",
  "Identifying competitors in your space…",
  "Preparing your setup…",
];

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

/** Left rail: wordmark, step-of-3 heading, vertical step list. */
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

/** "Why we need this" checklist — step 1 only (repeating it is wallpaper). */
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

/** Analyzing interstitial — pulsing beacon + rotating status lines. */
function Analyzing({ domain, onSkip }: { domain: string; onSkip: () => void }) {
  const reduced = useReducedMotion();
  const [line, setLine] = useState(0);
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const rotate = setInterval(
      () => setLine((l) => (l + 1) % ANALYZING_LINES.length),
      1800,
    );
    const skip = setTimeout(() => setShowSkip(true), 5000);
    return () => {
      clearInterval(rotate);
      clearTimeout(skip);
    };
  }, []);

  return (
    <div className="my-auto flex w-full max-w-md flex-col items-center gap-6 self-center py-10 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center" aria-hidden>
        {!reduced && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full bg-cobalt/20"
              animate={{ scale: [1, 1.9], opacity: [0.7, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              className="absolute inset-2 rounded-full bg-cobalt/25"
              animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
            />
          </>
        )}
        <span className="h-4 w-4 rounded-full bg-cobalt" />
      </div>
      <div>
        <h2 className="font-display text-2xl font-bold text-ink">
          Analyzing {domain || "your site"}
        </h2>
        <div className="mt-3 h-5" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.p
              key={line}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: reduced ? 0 : 0.25 }}
              className="text-sm text-ink-secondary"
            >
              {ANALYZING_LINES[line]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
      {showSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-ink-secondary underline-offset-2 transition-colors hover:text-ink hover:underline"
        >
          Skip — fill in manually
        </button>
      )}
    </div>
  );
}

export function OnboardingWizard({ initialDomain = "" }: { initialDomain?: string }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Step 1 — brand domain (+ auto-detected name)
  const [brandDomain, setBrandDomain] = useState(initialDomain);
  const [brandName, setBrandName] = useState("");
  const [brandDetecting, setBrandDetecting] = useState(false);

  // Step 2 — confirm: markets + competitors (agent-prefilled, fully editable)
  const [markets, setMarkets] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>(() => [blankRow()]);

  // Setup agent (onboarding-suggest). User edits always win over late results.
  const [suggestedMarkets, setSuggestedMarkets] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestFailed, setSuggestFailed] = useState(false);
  const [skippedAnalyzing, setSkippedAnalyzing] = useState(false);
  const [competitorsPrefilled, setCompetitorsPrefilled] = useState(false);
  const marketsTouched = useRef(false);
  const competitorsTouched = useRef(false);
  const suggestedForDomain = useRef<string | null>(null);

  function runSuggestion(domain: string) {
    const key = domain.trim().toLowerCase();
    if (!key || suggestedForDomain.current === key) return;
    suggestedForDomain.current = key;
    setSuggesting(true);
    setSuggestFailed(false);
    // Deterministic first: a ccTLD IS the country (gsb.ug → Uganda). Applies
    // instantly, no network, and survives any setup-agent failure. The agent's
    // richer result below can add markets; the user's edits always win.
    const tldMarket = marketFromDomain(domain);
    if (tldMarket) {
      setSuggestedMarkets((prev) => (prev.includes(tldMarket) ? prev : [tldMarket, ...prev]));
      if (!marketsTouched.current) {
        setMarkets((prev) => (prev.includes(tldMarket) ? prev : [...prev, tldMarket]));
      }
    }
    suggestOnboarding(domain)
      .then((s) => {
        setSuggestedMarkets(s.markets);
        setBrandName((prev) => (prev.trim() ? prev : (s.name ?? prev)));
        if (!marketsTouched.current && s.markets.length > 0) {
          setMarkets(s.markets);
        }
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
        // Detection "succeeded" but found nothing usable → treat as a failure so
        // the user is told loudly instead of silently facing empty fields.
        if (s.markets.length === 0 && s.competitors.length === 0) {
          setSuggestFailed(true);
        }
      })
      .catch(() => {
        // The wizard still works fully manually — but say so, don't fail silent.
        setSuggestFailed(true);
      })
      .finally(() => setSuggesting(false));
  }

  /** Re-run auto-detection for the current domain (clears the once-per-domain latch). */
  function retrySuggestion() {
    suggestedForDomain.current = null;
    runSuggestion(brandDomain);
  }

  // Re-run competitor discovery scoped to the user's CONFIRMED markets
  // (brand → country → competitors, in that order). Merges suggestions after the
  // user's own non-empty rows, deduped by domain, capped at COMPETITOR_MAX.
  const [marketSuggesting, setMarketSuggesting] = useState(false);
  async function suggestForMarkets() {
    if (markets.length === 0 || marketSuggesting) return;
    setMarketSuggesting(true);
    try {
      const s = await suggestOnboarding(brandDomain, markets);
      if (s.competitors.length > 0) {
        setCompetitors((prev) => {
          const kept = prev.filter((c) => c.domain.trim().length > 0);
          const seen = new Set(kept.map((c) => c.domain.trim().toLowerCase()));
          const added = s.competitors
            .filter((c) => c.domain && !seen.has(c.domain.toLowerCase()))
            .map((c) => ({ ...blankRow(), domain: c.domain, name: c.name, tier: c.tier }));
          return [...kept, ...added].slice(0, COMPETITOR_MAX);
        });
        setCompetitorsPrefilled(true);
        setSuggestFailed(false);
      } else {
        setSuggestFailed(true);
      }
    } catch {
      setSuggestFailed(true);
    } finally {
      setMarketSuggesting(false);
    }
  }

  // ---- handlers ----
  async function detectBrandName(domain: string) {
    if (!domain.trim()) return;
    setBrandDetecting(true);
    try {
      const res = await detectBrand(domain);
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

  // ---- validation ----
  const canLeaveDomain = brandDomain.trim().length > 0;
  const canSubmit =
    markets.length >= 1 && competitors.some((c) => c.domain.trim().length > 0);

  function next() {
    setError(null);
    if (!canLeaveDomain) return;
    runSuggestion(brandDomain);
    setStep(1);
  }
  function back() {
    setError(null);
    setStep(0);
  }

  function submit() {
    setError(null);
    const payload = {
      brandDomain,
      brandName,
      markets,
      industry: "igaming", // single-vertical MVP — not asked in the wizard
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

  const showAnalyzing = step === 1 && suggesting && !skippedAnalyzing;
  const stepTransition = reduced ? { duration: 0 } : { duration: 0.22, ease: "easeOut" as const };

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
        {/* Left rail (+ why-card on step 1 only) */}
        <div className="hidden flex-col gap-5 md:flex">
          <StepRail current={step} />
          {step === 0 && <WhyCard />}
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

            <AnimatePresence mode="wait" initial={false}>
              {step === 0 && (
                <motion.div
                  key="domain"
                  initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -10 }}
                  transition={stepTransition}
                  className="my-auto flex w-full max-w-md flex-col gap-5 self-center"
                >
                  <div>
                    <h2 className="font-display text-2xl font-bold text-ink">
                      What is your brand&rsquo;s domain?
                    </h2>
                    <p className="mt-2 text-sm text-ink-secondary">
                      We&rsquo;ll analyze it to detect your name, markets, and
                      competitors — you confirm everything on the next screen.
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
                  <PrimaryButton onClick={next} disabled={!canLeaveDomain}>
                    Continue →
                  </PrimaryButton>
                  <div className="rounded-chip bg-base-secondary px-4 py-3 text-xs leading-relaxed text-ink-secondary">
                    We will scan your site and public data sources to build your
                    competitive intelligence.
                  </div>
                </motion.div>
              )}

              {showAnalyzing && (
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={stepTransition}
                  className="flex flex-1 flex-col"
                >
                  <Analyzing
                    domain={brandDomain}
                    onSkip={() => setSkippedAnalyzing(true)}
                  />
                </motion.div>
              )}

              {step === 1 && !showAnalyzing && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: reduced ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -10 }}
                  transition={stepTransition}
                  className="flex w-full flex-col gap-6"
                >
                  <div>
                    <h2 className="font-display text-2xl font-bold text-ink">
                      Here&rsquo;s what we found — confirm &amp; launch
                    </h2>
                    <p className="mt-2 text-sm text-ink-secondary">
                      {suggestedMarkets.length > 0 || competitorsPrefilled ? (
                        <>
                          <span className="font-medium text-cobalt">✦ Detected</span>{" "}
                          from {brandName || brandDomain}. Everything is editable —
                          your changes always win.
                        </>
                      ) : (
                        <>Tell us where you compete and who you&rsquo;re up against.</>
                      )}
                    </p>
                  </div>

                  <TextInput
                    label="Brand name"
                    placeholder="Your brand"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />

                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-ink-secondary">
                      Markets — anywhere in the world
                    </span>
                    <MarketCombobox
                      selected={markets}
                      suggested={suggestedMarkets}
                      onToggle={toggleMarket}
                    />
                  </div>

                  {suggestFailed && (
                    <div className="flex items-center justify-between gap-3 rounded-chip border border-watch/30 bg-watch/10 px-4 py-3 text-xs leading-relaxed text-ink-secondary">
                      <span>
                        We couldn&rsquo;t auto-detect your markets and competitors this
                        time. Add them manually below, or try detection again.
                      </span>
                      <button
                        type="button"
                        onClick={retrySuggestion}
                        disabled={suggesting}
                        className="shrink-0 rounded-chip border border-divider bg-card px-3 py-1.5 font-medium text-ink transition-colors hover:bg-base-secondary disabled:opacity-50"
                      >
                        {suggesting ? "Retrying…" : "Retry detection"}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-ink-secondary">
                        Competitors{" "}
                        <span className="font-normal text-ink-faint">
                          (up to {COMPETITOR_MAX})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={suggestForMarkets}
                        disabled={markets.length === 0 || marketSuggesting}
                        title={
                          markets.length === 0
                            ? "Pick at least one market first"
                            : "Suggest competitors operating in your selected markets"
                        }
                        className="shrink-0 rounded-chip border border-divider bg-card px-3 py-1.5 text-xs font-medium text-cobalt transition-colors hover:bg-base-secondary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {marketSuggesting ? "Finding…" : "✦ Suggest for my markets"}
                      </button>
                    </div>
                    <CompetitorList
                      competitors={competitors}
                      onChange={patchCompetitor}
                      onRemove={removeCompetitor}
                      onAdd={addCompetitor}
                      onDetect={detectCompetitor}
                    />
                  </div>

                  {competitors.filter((c) => c.domain.trim()).length > 0 &&
                    competitors.filter((c) => c.domain.trim()).length < 3 && (
                      <p className="text-xs leading-relaxed text-ink-faint">
                        Tracking only{" "}
                        {competitors.filter((c) => c.domain.trim()).length} competitor
                        {competitors.filter((c) => c.domain.trim()).length === 1 ? "" : "s"}{" "}
                        — adding 3–5 gives a much richer weekly action plan. You can
                        also add more later in Admin → Competitors.
                      </p>
                    )}

                  <PrimaryButton onClick={submit} disabled={!canSubmit || pending}>
                    {pending ? "Setting up…" : "Start first scan →"}
                  </PrimaryButton>
                </motion.div>
              )}
            </AnimatePresence>

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

      {/* Mobile why-card below the flow (step 1 only) */}
      {step === 0 && (
        <div className="mt-5 md:hidden">
          <WhyCard />
        </div>
      )}
    </div>
  );
}
