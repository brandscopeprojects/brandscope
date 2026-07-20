"use client";

// VoiceSessionPanel — the focused voice surface. Desktop: a centred modal with
// the dashboard dimmed behind it. Mobile: a near-full-screen panel with
// safe-area insets and one-hand-reachable controls (End is ALWAYS visible).
// It is presentational — the RealtimeVoiceClient lifecycle lives in
// VoiceLauncher, which feeds this component state/level/turns and callbacks.

import { useCallback, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { PhoneOff, Mic, MicOff, Hand, Captions, CaptionsOff, RotateCcw, Wifi, WifiOff } from "lucide-react";
import type { VoiceState } from "@/lib/hq-agent/realtime-client";
import { VoiceWaveform } from "./voice-waveform";
import { VoiceStatus } from "./voice-status";
import { VoiceTranscript, type Turn } from "./voice-transcript";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export function VoiceSessionPanel({
  state,
  inputLevel,
  outputLevel,
  turns,
  transcriptVisible,
  showTranscript,
  onToggleTranscript,
  muted,
  error,
  onEnd,
  onMute,
  onInterrupt,
  onRetry,
}: {
  state: VoiceState;
  inputLevel: number;
  outputLevel: number;
  turns: Turn[];
  transcriptVisible: boolean;
  showTranscript: boolean;
  onToggleTranscript: () => void;
  muted: boolean;
  error: string | null;
  onEnd: () => void;
  onMute: (on: boolean) => void;
  onInterrupt: () => void;
  onRetry: () => void;
}) {
  const reduced = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);

  const level = state === "speaking" ? outputLevel : inputLevel;
  const connected = state === "listening" || state === "thinking" || state === "speaking";
  const isError = state === "error";
  const canInterrupt = state === "speaking";

  // Escape ends the session; focus-trap keeps Tab inside the dialog.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onEnd();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onEnd],
  );

  // Move focus into the dialog on mount.
  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const target = root.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4">
      {/* dimmed backdrop */}
      <motion.div
        aria-hidden
        onClick={onEnd}
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
        initial={reduced ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
      />

      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Voice conversation with the HQ Agent"
        onKeyDown={onKeyDown}
        initial={reduced ? { opacity: 1 } : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 32 }}
        className={[
          "relative flex w-full max-w-md flex-col overflow-hidden bg-base shadow-sh3",
          // mobile = near full screen w/ safe areas; desktop = floating card
          "h-full rounded-none pt-[env(safe-area-inset-top)] sm:h-auto sm:max-h-[88vh] sm:rounded-card sm:pt-0",
        ].join(" ")}
      >
        {/* header: title + connection indicator */}
        <div className="flex items-center justify-between border-b border-divider px-4 py-3">
          <p className="text-sm font-semibold text-ink">HQ Agent · Voice</p>
          <span
            className={[
              "flex items-center gap-1.5 text-xs font-medium",
              connected ? "text-opportunity" : isError ? "text-urgent" : "text-ink-faint",
            ].join(" ")}
            title={connected ? "Connected" : isError ? "Disconnected" : "Connecting"}
          >
            {connected ? <Wifi className="h-3.5 w-3.5" aria-hidden /> : <WifiOff className="h-3.5 w-3.5" aria-hidden />}
            <span>{connected ? "Live" : isError ? "Offline" : "…"}</span>
          </span>
        </div>

        {/* central visual + status */}
        <div className="flex flex-col items-center gap-4 px-4 py-6">
          <VoiceWaveform level={level} state={state} size={128} />
          <VoiceStatus state={state} />
          {error && (
            <p className="max-w-xs text-center text-sm text-urgent" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* transcript (scrolls; only when session exposes it & user shows it) */}
        {transcriptVisible && showTranscript && (
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-divider bg-base-secondary/40 px-3 py-3 sm:max-h-64">
            <VoiceTranscript turns={turns} />
          </div>
        )}

        {/* controls — End is always visible; safe-area padding on mobile */}
        <div className="mt-auto flex flex-wrap items-center justify-center gap-2 border-t border-divider bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {isError ? (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-2 rounded-chip bg-cobalt px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/50"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Retry
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onMute(!muted)}
                aria-pressed={muted}
                aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                className={[
                  "flex min-h-[44px] items-center gap-2 rounded-chip px-3.5 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/50",
                  muted ? "bg-urgent/10 text-urgent" : "bg-base-secondary text-ink-secondary hover:text-ink",
                ].join(" ")}
              >
                {muted ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
                <span>{muted ? "Unmute" : "Mute"}</span>
              </button>

              {canInterrupt && (
                <button
                  type="button"
                  onClick={onInterrupt}
                  aria-label="Interrupt the agent"
                  className="flex min-h-[44px] items-center gap-2 rounded-chip bg-watch/10 px-3.5 py-2.5 text-sm font-medium text-watch transition-colors hover:bg-watch/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-watch/50"
                >
                  <Hand className="h-4 w-4" aria-hidden />
                  <span>Interrupt</span>
                </button>
              )}

              {transcriptVisible && (
                <button
                  type="button"
                  onClick={onToggleTranscript}
                  aria-pressed={showTranscript}
                  aria-label={showTranscript ? "Hide transcript" : "Show transcript"}
                  className="flex min-h-[44px] items-center gap-2 rounded-chip bg-base-secondary px-3.5 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/50"
                >
                  {showTranscript ? <CaptionsOff className="h-4 w-4" aria-hidden /> : <Captions className="h-4 w-4" aria-hidden />}
                  <span>{showTranscript ? "Hide" : "Transcript"}</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onEnd}
            aria-label="End voice conversation"
            className="flex min-h-[44px] items-center gap-2 rounded-chip bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
          >
            <PhoneOff className="h-4 w-4" aria-hidden />
            End
          </button>
        </div>
      </motion.div>
    </div>
  );
}
