"use client";

// VoiceLauncher — the entry point for HQ Agent voice. Renders the circular
// black waveform button; on click it opens the VoiceSessionPanel and drives one
// RealtimeVoiceClient. It owns the session state, accumulates transcript turns,
// and — when the session ends — persists those turns to the shared conversation
// (voice transcripts become normal messages) before handing them back to the
// parent chat surface. Only ONE session may run at a time (button disabled while
// a session is open).

import { useCallback, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { RealtimeVoiceClient, type VoiceState } from "@/lib/hq-agent/realtime-client";
import { VoiceWaveform } from "./voice-waveform";
import { VoiceSessionPanel } from "./voice-session-panel";
import type { Turn } from "./voice-transcript";

type VoiceMessage = { role: "user" | "assistant"; content: string; created_at?: string };

export function VoiceLauncher({
  conversationId,
  onConversationId,
  onVoiceMessages,
  disabled = false,
}: {
  conversationId: string | null;
  onConversationId?: (id: string) => void;
  onVoiceMessages?: (msgs: VoiceMessage[]) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<VoiceState>("idle");
  const [inputLevel, setInputLevel] = useState(0);
  const [outputLevel, setOutputLevel] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [transcriptVisible, setTranscriptVisible] = useState(true);
  const [showTranscript, setShowTranscript] = useState(true);

  const clientRef = useRef<RealtimeVoiceClient | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const assistantStreamingRef = useRef(false);
  const savedRef = useRef(false);

  const closePanel = useCallback(() => {
    clientRef.current = null;
    setOpen(false);
    setState("idle");
    setInputLevel(0);
    setOutputLevel(0);
    setTurns([]);
    turnsRef.current = [];
    setError(null);
    setMuted(false);
  }, []);

  // Persist the transcript once (guarded), notify the parent, then close.
  const finalize = useCallback(async () => {
    if (savedRef.current) return;
    savedRef.current = true;

    const msgs: VoiceMessage[] = turnsRef.current
      .map((t) => ({ role: t.role, content: t.content.trim() }))
      .filter((t) => t.content.length > 0);

    if (msgs.length > 0) {
      try {
        const res = await fetch("/api/hq-agent/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, messages: msgs }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; conversationId?: string };
        onVoiceMessages?.(msgs);
        if (data.ok && data.conversationId) onConversationId?.(data.conversationId);
      } catch {
        // Saving is best-effort; still surface the turns to the parent.
        onVoiceMessages?.(msgs);
      }
    }
    closePanel();
  }, [conversationId, onConversationId, onVoiceMessages, closePanel]);

  const pushUserTurn = useCallback((text: string) => {
    const content = text.trim();
    if (!content) return;
    assistantStreamingRef.current = false; // a new user turn closes any assistant turn
    turnsRef.current = [...turnsRef.current, { role: "user", content }];
    setTurns(turnsRef.current);
  }, []);

  const handleAssistant = useCallback((text: string, done: boolean) => {
    const content = text;
    const arr = [...turnsRef.current];
    const last = arr[arr.length - 1];
    if (assistantStreamingRef.current && last && last.role === "assistant") {
      arr[arr.length - 1] = { role: "assistant", content };
    } else if (content.trim()) {
      arr.push({ role: "assistant", content });
      assistantStreamingRef.current = true;
    }
    if (done) assistantStreamingRef.current = false;
    turnsRef.current = arr;
    setTurns(arr);
  }, []);

  const handleState = useCallback(
    (s: VoiceState) => {
      setState(s);
      if (s === "listening") {
        setTranscriptVisible(clientRef.current?.transcriptVisible ?? true);
      }
      if (s === "listening" || s === "speaking" || s === "thinking") {
        setError(null); // clear transient notices once healthy again
      }
      if (s === "ended") void finalize();
    },
    [finalize],
  );

  const startSession = useCallback(() => {
    // Ensure no prior session lingers (also covers Retry from an error state).
    clientRef.current?.stop();

    turnsRef.current = [];
    assistantStreamingRef.current = false;
    savedRef.current = false;
    setTurns([]);
    setError(null);
    setMuted(false);
    setShowTranscript(true);
    setState("connecting");
    setOpen(true);

    const client = new RealtimeVoiceClient({
      onState: handleState,
      onUserTranscript: pushUserTurn,
      onAssistantTranscript: handleAssistant,
      onError: (msg) => setError(msg),
      onLevel: (kind, level) => (kind === "input" ? setInputLevel(level) : setOutputLevel(level)),
    });
    clientRef.current = client;
    void client.start(conversationId);
  }, [conversationId, handleState, pushUserTurn, handleAssistant]);

  const handleEnd = useCallback(() => {
    clientRef.current?.stop(); // idempotent; fires onState("ended") → finalize
    void finalize(); // covers already-terminal (error) sessions where stop() is a no-op
  }, [finalize]);

  const handleMute = useCallback((on: boolean) => {
    setMuted(on);
    clientRef.current?.mute(on);
  }, []);

  const handleInterrupt = useCallback(() => {
    clientRef.current?.interrupt();
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={startSession}
        disabled={disabled || open}
        aria-label="Start voice conversation"
        title="Start voice conversation"
        className="inline-flex items-center justify-center rounded-full p-0.5 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-cobalt/60 focus-visible:ring-offset-2 focus-visible:ring-offset-base disabled:opacity-50"
      >
        <span className="pointer-events-none flex min-h-[44px] min-w-[44px] items-center justify-center">
          <VoiceWaveform level={0} state="idle" size={52} />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <VoiceSessionPanel
            state={state}
            inputLevel={inputLevel}
            outputLevel={outputLevel}
            turns={turns}
            transcriptVisible={transcriptVisible}
            showTranscript={showTranscript}
            onToggleTranscript={() => setShowTranscript((v) => !v)}
            muted={muted}
            error={error}
            onEnd={handleEnd}
            onMute={handleMute}
            onInterrupt={handleInterrupt}
            onRetry={startSession}
          />
        )}
      </AnimatePresence>
    </>
  );
}
