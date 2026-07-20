"use client";

// VoiceStatus — the ALWAYS-PRESENT text status for the voice session. The
// animated waveform must never be the only indicator (no color-only status);
// this labelled line is the accessible source of truth. aria-live="polite" so
// screen readers announce transitions.

import {
  Loader2,
  Ear,
  Brain,
  Volume2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Mic,
} from "lucide-react";
import type { VoiceState } from "@/lib/hq-agent/realtime-client";

const STATUS: Record<VoiceState, { label: string; Icon: typeof Loader2; className: string; spin?: boolean }> = {
  idle: { label: "Ready", Icon: Mic, className: "text-ink-secondary" },
  connecting: { label: "Connecting…", Icon: Loader2, className: "text-cobalt", spin: true },
  listening: { label: "Listening…", Icon: Ear, className: "text-cobalt" },
  thinking: { label: "Thinking…", Icon: Brain, className: "text-watch" },
  speaking: { label: "Speaking…", Icon: Volume2, className: "text-opportunity" },
  reconnecting: { label: "Reconnecting…", Icon: RefreshCw, className: "text-watch", spin: true },
  ended: { label: "Ended", Icon: CheckCircle2, className: "text-ink-faint" },
  error: { label: "Error", Icon: AlertTriangle, className: "text-urgent" },
};

export function VoiceStatus({ state }: { state: VoiceState }) {
  const { label, Icon, className, spin } = STATUS[state];
  return (
    <div
      aria-live="polite"
      className={["flex items-center justify-center gap-2 text-sm font-medium", className].join(" ")}
    >
      <Icon className={["h-4 w-4", spin ? "animate-spin" : ""].join(" ")} aria-hidden />
      <span>{label}</span>
    </div>
  );
}
