export function SectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 w-24 rounded bg-divider" />
      <div className="space-y-3">
        <div className="h-3 w-full rounded bg-divider" />
        <div className="h-3 w-5/6 rounded bg-divider" />
        <div className="h-3 w-4/5 rounded bg-divider" />
      </div>
      <div className="grid grid-cols-2 gap-3 pt-4">
        <div className="h-12 rounded bg-divider" />
        <div className="h-12 rounded bg-divider" />
      </div>
    </div>
  );
}

export function SectionErrorFallback() {
  return (
    <div className="rounded-card border border-amber-500/20 bg-amber-50/10 p-4">
      <p className="text-sm text-amber-700 dark:text-amber-400">
        Data for this section could not be retrieved during this scan.
      </p>
    </div>
  );
}
