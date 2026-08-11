import type { MarketOverview as MarketOverviewData } from "@/lib/data/market-overview";

// Market-wide overview (Screen 4). Renders the market-scoped data from
// market_intel_cache: search-demand leaders, Google-Trends interest, SERP leaders,
// and each AI assistant's take. Server component — pure presentation of the view
// model built in lib/data/market-overview.ts.

const PLATFORM_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  perplexity: "Perplexity",
};

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return `${n}`;
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-card p-5 shadow-sh1">
      <div className="mb-3 space-y-0.5">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {hint && <p className="text-xs text-ink-secondary">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Horizontal share bars (0..max) — no external chart lib. */
function BarList({ rows }: { rows: { label: string; value: number; display: string }[] }) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium text-ink">{r.label}</span>
            <span className="shrink-0 font-mono text-ink-secondary">{r.display}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-base-secondary/60">
            <div
              className="h-full rounded-full bg-cobalt"
              style={{ width: `${Math.max(3, Math.round((r.value / max) * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MarketOverview({ data }: { data: MarketOverviewData }) {
  const { demandLeaders, interest, serpLeaders, aiVisibility } = data;

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold text-ink">Market Overview</h2>
        <p className="text-xs text-ink-secondary">
          Market-wide signals for this week — independent of your own scan.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {demandLeaders.length > 0 && (
          <Card title="Search demand leaders" hint="Monthly search volume by brand domain.">
            <BarList
              rows={demandLeaders.map((d) => ({
                label: d.label,
                value: d.volume,
                display: compactNumber(d.volume),
              }))}
            />
          </Card>
        )}

        {interest.length > 0 && (
          <Card title="Search interest" hint="Relative Google-Trends interest (0–100).">
            <BarList
              rows={interest.map((i) => ({ label: i.brand, value: i.score, display: `${i.score}` }))}
            />
          </Card>
        )}

        {serpLeaders.length > 0 && (
          <Card title="Search result leaders" hint="Top domains ranking for this market's betting searches.">
            <ol className="space-y-1.5">
              {serpLeaders.slice(0, 15).map((domain, i) => (
                <li key={`${domain}-${i}`} className="flex items-center gap-2 text-xs">
                  <span className="w-5 shrink-0 font-mono text-ink-faint">{i + 1}</span>
                  <span className="truncate text-ink">{domain}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {aiVisibility.length > 0 && (
          <Card title="AI assistant visibility" hint="How AI assistants answer “best betting sites” for this market.">
            <ul className="space-y-3">
              {aiVisibility.map((a) => (
                <li key={a.platform} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink">
                      {PLATFORM_LABEL[a.platform] ?? a.platform}
                    </span>
                    {a.mentionsTracked && (
                      <span className="rounded-chip bg-cobalt/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wide text-cobalt">
                        You / rival named
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-ink-secondary">{a.excerpt}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </section>
  );
}
