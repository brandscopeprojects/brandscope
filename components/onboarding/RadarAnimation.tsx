// RadarAnimation — animated cobalt radar sweep (Screen 2, scanning state).
// Dark-screen component (the ONLY dark screen, bg #141416). Pure CSS animation
// (keyframes in globals.css): a rotating cobalt sweep over concentric rings with a
// gently pulsing centre dot (own-brand marker — cobalt is the "this is you" signal).

export function RadarAnimation() {
  return (
    <div
      className="relative h-48 w-48 select-none"
      role="img"
      aria-label="Scanning the market"
    >
      {/* concentric rings */}
      <div className="absolute inset-0 rounded-full border border-white/10" />
      <div className="absolute inset-[16%] rounded-full border border-white/10" />
      <div className="absolute inset-[32%] rounded-full border border-white/10" />
      {/* crosshairs */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/10" />
      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/10" />
      {/* rotating cobalt sweep */}
      <div className="absolute inset-0 animate-radar-sweep">
        <div
          className="absolute left-1/2 top-1/2 h-1/2 w-1/2 origin-top-left"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(43,92,230,0.55), rgba(43,92,230,0) 70%)",
            borderTopLeftRadius: "100%",
          }}
        />
      </div>
      {/* pulsing own-brand centre dot */}
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-radar-pulse rounded-full bg-cobalt" />
    </div>
  );
}
