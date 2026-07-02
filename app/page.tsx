import Link from "next/link";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ShowcaseActionCard } from "@/components/marketing/ShowcaseActionCard";
import { HeroScanForm } from "@/components/marketing/HeroScanForm";
import { DEMO_BRAND, DEMO_DASHBOARD, DEMO_GEO } from "@/lib/data/demo";

// Marketing homepage — calm, spacious, one idea per screen. Every visual is the
// real product component with the RiversBet sample dataset, so the homepage can
// never drift from the actual UI. Public.

export const dynamic = "force-dynamic";

const MODULES =
  "Promotions · Traffic & SEO · GEO / AEO · Regulatory · Customers · Social & Ads · Hiring · Tech stack";

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

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.18em] text-ink-faint">
      {children}
    </p>
  );
}

export default function Home() {
  const heroRec = DEMO_DASHBOARD.recommendations[0];

  return (
    <div className="min-h-screen bg-base">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Wordmark />
        <nav className="flex items-center gap-7">
          <Link
            href="/preview"
            className="hidden text-sm text-ink-secondary transition-colors hover:text-ink sm:block"
          >
            Live example
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-ink transition-colors hover:text-cobalt"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pt-20 text-center md:pt-28">
        <Kicker>Competitive intelligence for iGaming · NG · KE · ZA</Kicker>
        <h1 className="mx-auto mt-7 max-w-4xl font-display text-[3.4rem] font-bold leading-[0.98] tracking-tight text-ink md:text-8xl">
          Know what your competitors did <span className="text-cobalt">this week.</span>
        </h1>
        <p className="mx-auto mt-9 max-w-xl text-lg leading-relaxed text-ink-secondary">
          Every Monday, Brandscope scans your market and hands you a ranked,
          evidence-backed action plan — with the marketing assets already written.
        </p>
        <div className="mt-10">
          <HeroScanForm />
          <p className="mt-5 text-sm text-ink-faint">
            First scan takes 2–3 minutes ·{" "}
            <Link href="/preview/dashboard" className="text-ink-secondary underline-offset-4 transition-colors hover:text-ink hover:underline">
              or see a live example
            </Link>
          </p>
        </div>
      </section>

      {/* ── Product shot, floating alone ────────────────────── */}
      <section className="mx-auto max-w-[1120px] px-4 pt-16 md:px-6 md:pt-20">
        <div className="overflow-hidden rounded-card bg-card shadow-sh3">
          <div className="flex items-center gap-2 border-b border-divider bg-base-secondary px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-divider" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-divider" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-divider" aria-hidden />
            <span className="ml-3 rounded-chip bg-card px-3 py-0.5 font-mono text-xs text-ink-faint">
              app.brandscope.io/dashboard
            </span>
          </div>
          <div className="relative max-h-[420px] overflow-hidden md:max-h-[620px]">
            <div className="pointer-events-none select-none bg-base p-4 md:p-6" aria-hidden>
              <DashboardView
                brandName={DEMO_BRAND.name}
                markets={DEMO_BRAND.market}
                data={DEMO_DASHBOARD}
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-base to-transparent" />
          </div>
        </div>
        <p className="mt-5 text-center text-sm text-ink-faint">
          The real dashboard, populated with sample data —{" "}
          <Link href="/preview/dashboard" className="text-ink-secondary underline-offset-4 transition-colors hover:text-ink hover:underline">
            open it
          </Link>
        </p>
      </section>

      {/* ── How it works — no boxes, big numbers ────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-32 text-center md:py-40">
        <Kicker>How Monday morning works</Kicker>
        <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-bold leading-tight text-ink md:text-5xl">
          The scan runs itself. You get the plan.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-secondary">
          Brandscope watches your competitors' promotions, rankings, AI visibility
          and compliance — then writes the week's plan before you're at your desk.
        </p>
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-14 sm:grid-cols-3">
          <div>
            <p className="font-display text-7xl font-bold tracking-tight text-ink md:text-8xl">8</p>
            <p className="mt-3 text-sm text-ink-secondary">intelligence modules scanned weekly</p>
          </div>
          <div>
            <p className="font-display text-7xl font-bold tracking-tight text-ink md:text-8xl">4–8</p>
            <p className="mt-3 text-sm text-ink-secondary">ranked actions, each with an asset</p>
          </div>
          <div>
            <p className="font-display text-7xl font-bold tracking-tight text-ink md:text-8xl">100%</p>
            <p className="mt-3 text-sm text-ink-secondary">of claims cite source, text and time</p>
          </div>
        </div>
      </section>

      {/* ── The visual moment — AI visibility, dark chapter ─── */}
      {/* Dark is the sanctioned "moment" treatment (ui-constraints §15.3).
          One meaningful colour on it: cobalt = you. Green only for the gain. */}
      <section className="mx-auto max-w-[1120px] px-4 pb-32 md:px-6 md:pb-40">
        <div className="overflow-hidden rounded-card bg-ink px-7 py-14 md:px-16 md:py-20">
          <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
            {/* copy + score */}
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">
                GEO · AI visibility
              </p>
              <h2 className="mt-5 font-display text-3xl font-bold leading-tight text-white md:text-4xl">
                When bettors ask ChatGPT, do you come up?
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-white/60">
                Brandscope asks the questions your customers ask — across ChatGPT,
                Claude, Gemini and Perplexity — and scores who the AI recommends.
              </p>
              <div className="mt-10 flex items-end gap-4">
                <p className="font-display text-7xl font-bold leading-none text-white">
                  {DEMO_GEO.score}
                  <span className="text-2xl text-white/40">/100</span>
                </p>
                <p className="pb-1.5 font-mono text-sm text-opportunity">
                  ▲ {DEMO_GEO.scoreChangeWow} vs last week
                </p>
              </div>
              <Link
                href="/preview/geo-aeo-seo"
                className="mt-8 inline-block text-sm text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                Explore GEO intelligence →
              </Link>
            </div>
            {/* leaderboard — cobalt marks you, everything else recedes */}
            <div className="min-w-0">
              <p className="mb-4 font-mono text-xs text-white/40">
                AI visibility score · Nigeria · week of 12 May
              </p>
              <ul className="space-y-3.5">
                {[
                  ...DEMO_GEO.competitorScores
                    .filter((c): c is typeof c & { score: number } => c.score !== null)
                    .map((c) => ({ name: c.competitorName, score: c.score, you: false })),
                  { name: DEMO_BRAND.name, score: DEMO_GEO.score ?? 0, you: true },
                ]
                  .sort((a, b) => b.score - a.score)
                  .map((row) => (
                    <li key={row.name}>
                      <div className="flex items-baseline justify-between">
                        <span
                          className={
                            row.you
                              ? "text-sm font-semibold text-white"
                              : "text-sm text-white/50"
                          }
                        >
                          {row.name}
                          {row.you && (
                            <span className="ml-2 rounded-chip bg-cobalt px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                              you
                            </span>
                          )}
                        </span>
                        <span
                          className={
                            row.you
                              ? "font-mono text-sm text-white"
                              : "font-mono text-sm text-white/40"
                          }
                        >
                          {row.score}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className={row.you ? "h-full rounded-full bg-cobalt" : "h-full rounded-full bg-white/25"}
                          style={{ width: `${Math.round((row.score / 82) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Evidence — one card, one idea ───────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-32 md:pb-40">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <Kicker>Evidence, not opinion</Kicker>
            <h2 className="mt-5 font-display text-3xl font-bold leading-tight text-ink md:text-4xl">
              Every recommendation cites its source.
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ink-secondary">
              Each action names its trigger and shows the verbatim text it was
              scraped from, with a link and a timestamp. Agree with it? The
              counter-campaign brief is one click away.
            </p>
          </div>
          <div className="min-w-0">
            <ShowcaseActionCard rec={heroRec} />
          </div>
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-32 text-center md:pb-40">
        <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold leading-tight text-ink md:text-5xl">
          Enter your domain and five competitors.
        </h2>
        <p className="mt-5 text-base text-ink-secondary">
          Your first action plan is ready the same morning.
        </p>
        <Link
          href="/login"
          className="mt-10 inline-block rounded-chip bg-cobalt px-8 py-3.5 text-sm font-semibold text-white shadow-sh1 transition-shadow hover:shadow-sh2"
        >
          Start your first scan
        </Link>
        <p className="mx-auto mt-14 max-w-2xl text-sm leading-relaxed text-ink-faint">{MODULES}</p>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-divider">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row">
          <Wordmark />
          <p className="text-xs text-ink-faint">
            Built for iGaming operators in Nigeria, Kenya and South Africa.
          </p>
        </div>
      </footer>
    </div>
  );
}
