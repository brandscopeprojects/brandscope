// RealtimeVoiceClient — browser-only WebRTC manager for ONE OpenAI Realtime
// voice session (HQ Agent voice cluster). NOTHING server-only lives here; this
// file runs in the browser. It:
//   • mints an ephemeral key from our own /api/hq-agent/realtime/session route
//     (the permanent OPENAI_API_KEY never reaches the browser),
//   • opens a WebRTC peer connection (mic → OpenAI, model audio → <audio>),
//   • carries model events over the "oai-events" data channel,
//   • forwards function-call requests to /api/hq-agent/realtime/tool (tools run
//     SERVER-SIDE only — never in the browser) and hands the output back,
//   • meters mic + model levels locally for the waveform (Web Audio is used for
//     visualisation ONLY — audio is never sent anywhere except OpenAI's PC),
//   • enforces max-session + idle timers and cleans up idempotently.

export type VoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "reconnecting"
  | "ended"
  | "error";

export type LevelKind = "input" | "output";

export type RealtimeCallbacks = {
  onState: (state: VoiceState) => void;
  onUserTranscript: (text: string) => void;
  onAssistantTranscript: (text: string, done: boolean) => void;
  onError: (msg: string) => void;
  onLevel: (kind: LevelKind, level: number) => void;
};

type SessionConfig = {
  value: string;
  expiresAt: number;
  model: string;
  voice: string;
  transcriptVisible: boolean;
  interruptions: boolean;
  maxSessionMinutes: number;
  idleTimeoutSeconds: number;
};

const OPENAI_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export class RealtimeVoiceClient {
  // Public session config, populated once start() has minted a session. The UI
  // reads these (e.g. when state first reaches "listening") to decide whether to
  // offer the transcript / interrupt affordances.
  public transcriptVisible = true;
  public interruptions = true;

  private cb: RealtimeCallbacks;

  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private micStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;

  private audioContext: AudioContext | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private rafId: number | null = null;

  private maxTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  private conversationId: string | null = null;
  private state: VoiceState = "idle";
  private muted = false;
  private stopped = false;
  private reconnectUsed = false;
  private idleSeconds = 0;

  // Assembles the current assistant turn's transcript from streamed deltas.
  private assistantBuffer = "";

  constructor(cb: RealtimeCallbacks) {
    this.cb = cb;
  }

  // ── public API ──────────────────────────────────────────────────────────────

  async start(conversationId: string | null): Promise<void> {
    this.conversationId = conversationId;
    this.stopped = false;
    this.reconnectUsed = false;
    this.setState("connecting");

    // a. mint ephemeral key from our own route
    let session: SessionConfig;
    try {
      const res = await fetch("/api/hq-agent/realtime/session", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as Partial<SessionConfig> & {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.value) {
        this.fail(data.error ?? this.friendlyStatus(res.status));
        return;
      }
      session = {
        value: data.value,
        expiresAt: data.expiresAt ?? 0,
        model: data.model ?? "",
        voice: data.voice ?? "",
        transcriptVisible: data.transcriptVisible ?? false,
        interruptions: data.interruptions ?? true,
        maxSessionMinutes: data.maxSessionMinutes ?? 10,
        idleTimeoutSeconds: data.idleTimeoutSeconds ?? 60,
      };
    } catch {
      this.fail("Couldn't reach the voice service. Check your connection and try again.");
      return;
    }
    if (this.stopped) return;

    this.transcriptVisible = session.transcriptVisible;
    this.interruptions = session.interruptions;
    this.idleSeconds = session.idleTimeoutSeconds;

    // b. microphone
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") this.fail("Microphone access was blocked.");
      else if (name === "NotFoundError" || name === "OverconstrainedError") this.fail("No microphone found.");
      else this.fail("Couldn't access the microphone.");
      return;
    }
    if (this.stopped) {
      this.teardown("ended");
      return;
    }

    await this.negotiate(session);

    if (!this.stopped) {
      // session-length + idle timers
      this.maxTimer = setTimeout(
        () => {
          this.cb.onError("Voice session ended (time limit reached).");
          this.stop();
        },
        Math.max(1, session.maxSessionMinutes) * 60 * 1000,
      );
      this.armIdleTimer();
    }
  }

  stop(): void {
    this.teardown("ended");
  }

  mute(on: boolean): void {
    this.muted = on;
    this.micStream?.getAudioTracks().forEach((t) => {
      t.enabled = !on;
    });
  }

  interrupt(): void {
    this.safeSend({ type: "response.cancel" });
  }

  // ── WebRTC negotiation ───────────────────────────────────────────────────────

  private async negotiate(session: SessionConfig): Promise<void> {
    try {
      const pc = new RTCPeerConnection();
      this.pc = pc;

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        if ((s === "disconnected" || s === "failed") && !this.stopped) {
          void this.handleDrop(session);
        }
      };

      // c. mic track out + remote audio in
      const micTrack = this.micStream?.getAudioTracks()[0];
      if (micTrack && this.micStream) {
        micTrack.enabled = !this.muted;
        pc.addTrack(micTrack, this.micStream);
      }

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.setAttribute("aria-hidden", "true");
      audioEl.style.display = "none";
      document.body.appendChild(audioEl);
      this.audioEl = audioEl;

      pc.ontrack = (e) => {
        this.remoteStream = e.streams[0] ?? null;
        if (this.audioEl) {
          this.audioEl.srcObject = e.streams[0];
          void this.audioEl.play().catch(() => {
            this.cb.onError("Audio playback is blocked — tap the screen to enable sound.");
          });
        }
        this.attachOutputAnalyser();
      };

      // d. data channel
      const dc = pc.createDataChannel("oai-events");
      this.dc = dc;
      dc.onopen = () => {
        // Config is already applied server-side on the ephemeral session; a
        // session.update here is optional and intentionally omitted.
      };
      dc.onmessage = (ev) => this.onDataMessage(ev);

      // e. SDP offer/answer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const answerRes = await fetch(`${OPENAI_CALLS_URL}?model=${encodeURIComponent(session.model)}`, {
        method: "POST",
        body: offer.sdp ?? "",
        headers: {
          Authorization: `Bearer ${session.value}`,
          "Content-Type": "application/sdp",
        },
      });
      if (!answerRes.ok) throw new Error(`SDP exchange failed (${answerRes.status})`);
      const answerSdp = await answerRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      if (this.stopped) {
        this.teardown("ended");
        return;
      }

      this.startMetering();
      this.setState("listening");
    } catch {
      if (!this.reconnectUsed && !this.stopped) {
        this.reconnectUsed = true;
        this.setState("reconnecting");
        this.closePeer();
        await this.negotiate(session);
      } else {
        this.cb.onError("WebRTC negotiation failed");
        this.fail("Voice connection failed. Please retry.");
      }
    }
  }

  private async handleDrop(session: SessionConfig): Promise<void> {
    if (this.reconnectUsed || this.stopped) {
      if (!this.stopped) this.fail("The voice connection dropped. Please retry.");
      return;
    }
    this.reconnectUsed = true;
    this.setState("reconnecting");
    this.closePeer();
    await this.negotiate(session);
  }

  // ── data-channel events ──────────────────────────────────────────────────────

  private onDataMessage(ev: MessageEvent): void {
    let event: {
      type?: string;
      transcript?: string;
      delta?: string;
      name?: string;
      call_id?: string;
      arguments?: string;
      error?: { message?: string };
    };
    try {
      event = JSON.parse(ev.data as string);
    } catch {
      return;
    }
    const type = event.type ?? "";

    switch (type) {
      case "input_audio_buffer.speech_started":
        this.markActivity();
        this.setState("listening");
        break;
      case "input_audio_buffer.speech_stopped":
        this.markActivity();
        this.setState("thinking");
        break;
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        this.markActivity();
        this.assistantBuffer += event.delta ?? "";
        this.setState("speaking");
        this.cb.onAssistantTranscript(this.assistantBuffer, false);
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        this.markActivity();
        const finalText = event.transcript ?? this.assistantBuffer;
        this.cb.onAssistantTranscript(finalText, true);
        this.assistantBuffer = "";
        break;
      }
      case "conversation.item.input_audio_transcription.completed":
        this.markActivity();
        if (event.transcript) this.cb.onUserTranscript(event.transcript);
        break;
      case "response.function_call_arguments.done":
        void this.runServerTool(event.name ?? "", event.call_id ?? "", event.arguments ?? "{}");
        break;
      case "error":
        this.cb.onError(event.error?.message ?? "The voice service reported an error.");
        break;
      default:
        break;
    }
  }

  // f. server-side tool execution — tools NEVER run in the browser.
  private async runServerTool(name: string, callId: string, rawArgs: string): Promise<void> {
    let output = JSON.stringify({ error: "tool failed" });
    try {
      const res = await fetch("/api/hq-agent/realtime/tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          arguments: JSON.parse(rawArgs || "{}"),
          conversationId: this.conversationId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { output?: string };
      if (typeof data.output === "string") output = data.output;
    } catch {
      /* keep the error output fallback */
    }
    if (this.stopped) return;
    this.safeSend({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output },
    });
    this.safeSend({ type: "response.create" });
  }

  private safeSend(payload: unknown): void {
    if (this.dc && this.dc.readyState === "open") {
      try {
        this.dc.send(JSON.stringify(payload));
      } catch {
        /* channel closing — ignore */
      }
    }
  }

  // ── level metering (local visualisation only) ────────────────────────────────

  private ensureAudioContext(): AudioContext | null {
    if (this.audioContext) return this.audioContext;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.audioContext = new Ctor();
    return this.audioContext;
  }

  private startMetering(): void {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    if (this.micStream) {
      const src = ctx.createMediaStreamSource(this.micStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      this.inputAnalyser = analyser;
    }
    this.attachOutputAnalyser();
    this.loopMetering();
  }

  private attachOutputAnalyser(): void {
    const ctx = this.audioContext;
    if (!ctx || !this.remoteStream || this.outputAnalyser) return;
    try {
      const src = ctx.createMediaStreamSource(this.remoteStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      this.outputAnalyser = analyser;
    } catch {
      /* some browsers reject remote-stream sources — skip output metering */
    }
  }

  private loopMetering(): void {
    const tick = () => {
      if (this.stopped) return;
      if (this.inputAnalyser && !this.muted) this.cb.onLevel("input", rms(this.inputAnalyser));
      else if (this.inputAnalyser) this.cb.onLevel("input", 0);
      if (this.outputAnalyser) this.cb.onLevel("output", rms(this.outputAnalyser));
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  // ── idle handling ────────────────────────────────────────────────────────────

  private armIdleTimer(): void {
    if (this.idleSeconds <= 0) return;
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.cb.onError("Voice session ended (no activity).");
      this.stop();
    }, this.idleSeconds * 1000);
  }

  private markActivity(): void {
    if (this.stopped || this.idleSeconds <= 0) return;
    this.armIdleTimer();
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  // ── state + cleanup ──────────────────────────────────────────────────────────

  private setState(state: VoiceState): void {
    if (this.state === state) return;
    this.state = state;
    this.cb.onState(state);
  }

  private fail(msg: string): void {
    this.cb.onError(msg);
    this.teardown("error");
  }

  private friendlyStatus(status: number): string {
    if (status === 503) return "Voice isn't configured yet.";
    if (status === 429) return "Voice session limit reached. Please try again later.";
    if (status === 403) return "You don't have access to voice.";
    return "Couldn't start a voice session. Please try again.";
  }

  private closePeer(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    try {
      this.dc?.close();
    } catch {
      /* ignore */
    }
    this.dc = null;
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.inputAnalyser = null;
    this.outputAnalyser = null;
    this.remoteStream = null;
  }

  // j. idempotent teardown
  private teardown(finalState: VoiceState): void {
    if (this.stopped) return;
    this.stopped = true;

    if (this.maxTimer) {
      clearTimeout(this.maxTimer);
      this.maxTimer = null;
    }
    this.clearIdleTimer();

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;

    this.closePeer();

    if (this.audioContext) {
      void this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.srcObject = null;
        this.audioEl.remove();
      } catch {
        /* ignore */
      }
      this.audioEl = null;
    }

    this.setState(finalState);
  }
}

/** Root-mean-square amplitude 0..1 from an analyser's time-domain data. */
function rms(analyser: AnalyserNode): number {
  const buf = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  const raw = Math.sqrt(sum / buf.length);
  // Gentle gain so quiet speech still moves the bars; clamp to 0..1.
  return Math.min(1, raw * 2.4);
}
