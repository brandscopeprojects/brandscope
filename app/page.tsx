import Link from "next/link";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { ShowcaseActionCard } from "@/components/marketing/ShowcaseActionCard";
import { DEMO_BRAND, DEMO_DASHBOARD } from "@/lib/data/demo";

// Marketing homepage (Option A — "the product is the homepage"). Public.
// Every visual is the real product component populated with the RiversBet
// sample dataset, so the homepage can never drift from the actual UI.

export const dynamic = "force-dynamic";

const MODULES = [
  "Promotion Signals",
  "Traffic & SEO",
  "GEO / AEO Visibility",
  "Regulatory Compliance",
  "Customer Intelligence",
  "Social & Ads",
  "Hiring & Signals",
  "Tech Stack",
];

const STEPS = [
  {
    step: "01",
    title: "The scan runs by itself",
    body: "Every Monday at 02:00 WAT, Brandscope scans your competitors' promotions, rankings, AI visibility, compliance and more. You do nothing.",
    mono: "cron  0 1 * * 1 UTC",
  },
  {
    step: "02",
    title: "Every claim carries its evidence",
    body: "Each finding stores the source URL, the exact scraped text and a timestamp. Open the evidence drawer on any card and check it yourself.",
    mono: "sha-256 · source · scraped_at",
  },
  {
    step: "03",
    title: "You get actions, not charts",
    body: "4–8 ranked recommendations, each with a pre-written marketing asset. Read the plan, generate the asset, ship it before the weekend fixtures.",
    mono: "4–8 actions / week",
  },
];

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

export default function Home() {
  const heroRec = DEMO_DASHBOARD.recommendations[0];

  return (
    <div className="min-h-screen bg-base">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Wordmark />
        <nav className="flex items-center gap-5">
          <Link
            href="/preview"
            className="hidden text-sm text-ink-secondary transition-colors hover:text-ink sm:block"
          >
            Live example
          </Link>
          <Link
            href="/login"
            className="rounded-chip bg-cobalt px-4 py-2 text-sm font-medium text-white shadow-sh1 transition-shadow hover:shadow-sh2"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-14 text-center md:pt-20">
        <p className="mx-auto mb-5 w-fit rounded-full bg-base-secondary px-4 py-1.5 font-mono text-xs text-ink-secondary">
          Competitive intelligence for iGaming — Nigeria · Kenya · South Africa
        </p>
        <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-tight text-ink md:text-6xl">
          Know what your competitors did this week — and what to do about it.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-secondary md:text-lg">
          Brandscope scans your market every Monday and hands you an
          evidence-backed action plan: what changed, why it matters, and the
          marketing asset to respond with — already written.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-chip bg-cobalt px-6 py-3 text-sm font-semibold text-white shadow-sh1 transition-shadow hover:shadow-sh2"
          >
            Start your first scan
          </Link>
          <Link
            href="/preview/dashboard"
            className="rounded-chip px-6 py-3 text-sm font-semibold text-cobalt transition-colors hover:bg-base-secondary"
          >
            See a live example →
          </Link>
        </div>
        <p className="mt-4 font-mono text-xs text-ink-faint">
          First scan takes 2–3 minutes. No card required.
        </p>
      </section>

      {/* ── Live product shot (the real dashboard) ──────────── */}
      <section className="mx-auto max-w-[1200px] px-4 md:px-6">
        <div className="overflow-hidden rounded-card border border-divider bg-card shadow-sh3">
          {/* browser chrome */}
          <div className="flex items-center gap-2 border-b border-divider bg-base-secondary px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-divider" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-divider" aria-hidden />
            <span className="h-2.5 w-2.5 rounded-full bg-divider" aria-hidden />
            <span className="ml-3 rounded-chip bg-card px-3 py-0.5 font-mono text-xs text-ink-faint">
              app.brandscope.io/dashboard
            </span>
          </div>
          {/* the actual DashboardView, display-only, clipped with a fade */}
          <div className="relative max-h-[560px] overflow-hidden md:max-h-[680px]">
            <div className="pointer-events-none select-none bg-base p-4 md:p-6" aria-hidden>
              <DashboardView
                brandName={DEMO_BRAND.name}
                markets={DEMO_BRAND.market}
                data={DEMO_DASHBOARD}
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-card to-transparent" />
          </div>
          <div className="flex items-center justify-between border-t border-divider px-5 py-3">
            <p className="text-sm text-ink-secondary">
              This is the real dashboard, populated with a sample dataset — not a mockup.
            </p>
            <Link href="/preview/dashboard" className="whitespace-nowrap text-sm font-medium text-cobalt">
              Open it →
            </Link>
          </div>
        </div>
      </section>

      {/* ── How Monday morning works ────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center font-display text-2xl font-bold text-ink md:text-3xl">
          How Monday morning works
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.step} className="rounded-card bg-card p-6 shadow-sh1">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl font-bold text-ink">{s.step}</span>
                <span className="font-mono text-[11px] text-ink-faint">{s.mono}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── One real action card ────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
              Every recommendation cites its source.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-secondary">
              No black-box scores. Each action names the trigger, shows the
              verbatim text it was scraped from, and links to the page it came
              from. Open the evidence drawer and verify it in one click.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-secondary">
              Agree with it? Generate the counter-campaign brief on the spot —
              headline options, body copy, channels and budget, written from the
              same evidence.
            </p>
          </div>
          <div className="min-w-0">
            <ShowcaseActionCard rec={heroRec} />
          </div>
        </div>
      </section>

      {/* ── Module strip ────────────────────────────────────── */}
      <section className="border-y border-divider bg-base-secondary/50">
        <div className="mx-auto max-w-6xl px-6 py-14 text-center">
          <h2 className="font-display text-xl font-bold text-ink md:text-2xl">
            Eight intelligence modules. One weekly plan.
          </h2>
          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-2.5">
            {MODULES.map((m) => (
              <span
                key={m}
                className="rounded-chip bg-card px-3.5 py-1.5 text-sm text-ink-secondary shadow-sh1"
              >
                {m}
              </span>
            ))}
          </div>
          <p className="mx-auto mt-6 max-w-xl text-sm text-ink-secondary">
            Plus between-cycle alerts when a competitor changes something big
            before the next Monday scan.
          </p>
        </div>
      </section>

      {/* ── Footer CTA ──────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold text-ink md:text-4xl">
          Enter your domain and five competitors.
        </h2>
        <p className="mt-4 text-base text-ink-secondary">
          The first scan takes 2–3 minutes. Your first action plan is ready the same morning.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-chip bg-cobalt px-8 py-3.5 text-sm font-semibold text-white shadow-sh1 transition-shadow hover:shadow-sh2"
        >
          Start your first scan
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-divider">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row">
          <Wordmark />
          <p className="font-mono text-xs text-ink-faint">
            Built for iGaming operators in Nigeria, Kenya and South Africa.
          </p>
        </div>
      </footer>
    </div>
  );
}
