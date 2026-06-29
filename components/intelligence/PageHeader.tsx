// PageHeader — the title block shared by every intelligence page (ui-constraints
// §4). Title in Syne, optional subtitle (ink-secondary), optional scan-week stamp
// (mono) and a right-aligned actions slot. Presentational. Tokens only.

import { formatScanWeek } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  scanWeek,
  actions,
}: {
  title: string;
  subtitle?: string;
  scanWeek?: string | null;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        {subtitle && (
          <p className="max-w-2xl text-sm leading-6 text-ink-secondary">{subtitle}</p>
        )}
        {scanWeek && (
          <p className="font-mono text-xs text-ink-faint">{formatScanWeek(scanWeek)}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
