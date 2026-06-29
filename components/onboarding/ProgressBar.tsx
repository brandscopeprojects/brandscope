// ProgressBar — cobalt progress bar with % (Screen 2, scanning state).
// Dark-screen component. Cobalt fill = the primary progress signal.

type ProgressBarProps = {
  /** 0–100 */
  percent: number;
};

export function ProgressBar({ percent }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-white/60">Scanning</span>
        <span className="font-mono text-xs text-white/80">{clamped}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-cobalt transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
