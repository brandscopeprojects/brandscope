"use client";

// VoiceWaveform — the circular BLACK voice surface with WHITE vertical bars.
// Used two ways: as the idle launcher button preview, and as the big central
// reactive visual inside the session panel. It is NEVER the only status signal
// (see VoiceStatus) and honours prefers-reduced-motion: when reduced, bars are
// static and no pulsing occurs.

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { VoiceState } from "@/lib/hq-agent/realtime-client";

const BAR_COUNT = 7;
// A symmetric base profile (tall in the middle) so even a static waveform reads
// as a waveform rather than a flat block.
const BASE = [0.32, 0.5, 0.74, 1, 0.74, 0.5, 0.32];

export function VoiceWaveform({
  level,
  state,
  size = 96,
}: {
  level: number;
  state: VoiceState;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const reactive = state === "listening" || state === "speaking";
  const clamped = Math.max(0, Math.min(1, level));

  // Per-bar target heights (fraction of the bar track). Reactive states scale
  // the base profile by the live RMS level; other states show the calm profile.
  const heights = useMemo(() => {
    return BASE.map((b) => {
      if (reactive && !reduced) {
        const amp = 0.28 + clamped * 0.72 * b;
        return Math.max(0.18, Math.min(1, amp));
      }
      return 0.34 + b * 0.34; // calm static profile
    });
  }, [reactive, reduced, clamped]);

  const isError = state === "error";
  const surface = isError ? "bg-urgent" : "bg-ink";
  const barTrack = Math.round(size * 0.44);

  // Calm pulse for the whole disc while "thinking" (never when reduced-motion).
  const pulse =
    state === "thinking" && !reduced
      ? { scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }
      : { scale: 1, opacity: 1 };

  return (
    <motion.div
      animate={pulse}
      transition={
        state === "thinking" && !reduced
          ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0 }
      }
      className={[
        "relative flex items-center justify-center rounded-full shadow-sh1",
        surface,
      ].join(" ")}
      style={{ width: size, height: size }}
    >
      {/* connecting: subtle rotating progress ring (motion-safe) */}
      {state === "connecting" && !reduced && (
        <motion.span
          aria-hidden
          className="absolute inset-1 rounded-full border-2 border-white/25 border-t-white/80"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
        />
      )}

      <div className="flex items-end gap-[3px]" style={{ height: barTrack }}>
        {heights.map((h, i) => {
          const target = `${Math.round(h * 100)}%`;
          return (
            <motion.span
              key={i}
              className="w-[3px] rounded-full bg-white sm:w-[4px]"
              style={{ minHeight: 4 }}
              animate={{ height: target }}
              transition={
                reduced
                  ? { duration: 0 }
                  : reactive
                    ? { type: "spring", stiffness: 500, damping: 26 }
                    : { duration: 0.4, ease: "easeInOut" }
              }
            />
          );
        })}
      </div>
    </motion.div>
  );
}
