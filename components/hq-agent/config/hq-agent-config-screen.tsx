"use client";

// HQ Agent config screen (§13). Loads the draft-or-published config, renders each
// section bound to the shared config object, and drives save-draft / publish /
// restore through /api/hq-agent/config. AdminTabs is route-based and not suited to
// in-page section switching, so we use a simple stacked section list per the brief.

import { useCallback, useEffect, useMemo, useState } from "react";
import { IdentitySection } from "./identity-section";
import { InstructionsSection } from "./instructions-section";
import { TextSection } from "./text-section";
import { VoiceSection } from "./voice-section";
import { DataAccessSection } from "./data-access-section";
import { SafetySection } from "./safety-section";
import { UsageSection } from "./usage-section";
import { MemorySection } from "./memory-section";
import { TestPublishBar } from "./test-publish-bar";
import type {
  ConfigResponse,
  ConfigStatus,
  EnvStatus,
  HqConfig,
  ToolCategoryMeta,
} from "./types";

type Loaded = {
  config: HqConfig;
  status: ConfigStatus;
  env: EnvStatus;
  models: { text: string; realtime: string };
  voices: string[];
  toolCategories: ToolCategoryMeta[];
};

export function HqAgentConfigScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [config, setConfig] = useState<HqConfig | null>(null);
  const [status, setStatus] = useState<ConfigStatus>("default");
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/hq-agent/config");
        const data: ConfigResponse = await res.json();
        if (!alive) return;
        if (!data.ok) {
          setLoadError("You do not have access to the HQ Agent settings.");
          return;
        }
        setLoaded({
          config: data.config,
          status: data.status,
          env: data.env,
          models: data.models,
          voices: data.voices,
          toolCategories: data.toolCategories,
        });
        setConfig(data.config);
        setStatus(data.status);
        setSavedSnapshot(JSON.stringify(data.config));
      } catch {
        if (alive) setLoadError("Could not load the HQ Agent settings.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const patch = useCallback(
    <K extends keyof HqConfig>(key: K, value: Partial<HqConfig[K]>) => {
      setSaveMessage(null);
      setConfig((c) => (c ? { ...c, [key]: { ...c[key], ...value } } : c));
    },
    [],
  );

  const dirty = useMemo(
    () => (config ? JSON.stringify(config) !== savedSnapshot : false),
    [config, savedSnapshot],
  );

  const submit = useCallback(
    async (action: "save_draft" | "publish" | "restore") => {
      if (!config) return;
      setBusy(true);
      setSaveMessage(null);
      setSaveError(null);
      try {
        const res = await fetch("/api/hq-agent/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "restore" ? { action } : { action, config },
          ),
        });
        const data = await res.json();
        if (!data.ok) {
          setSaveError(data.error ?? "Save failed.");
          return;
        }
        setConfig(data.config);
        setStatus(data.status);
        setSavedSnapshot(JSON.stringify(data.config));
        setSaveMessage(
          action === "publish"
            ? "Published live."
            : action === "restore"
              ? "Restored last published."
              : "Draft saved.",
        );
      } catch {
        setSaveError("Could not reach the server.");
      } finally {
        setBusy(false);
      }
    },
    [config],
  );

  if (loadError) {
    return (
      <div
        className="rounded-card border border-urgent/30 bg-urgent/5 p-6 text-sm text-urgent"
        role="alert"
      >
        {loadError}
      </div>
    );
  }

  if (!loaded || !config) {
    return (
      <div className="rounded-card bg-card p-6 text-sm text-ink-faint shadow-sh1">
        Loading HQ Agent settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <IdentitySection
        value={config.identity}
        onChange={(p) => patch("identity", p)}
      />
      <InstructionsSection
        value={config.instructions}
        onChange={(p) => patch("instructions", p)}
      />
      <TextSection
        value={config.text}
        onChange={(p) => patch("text", p)}
        model={loaded.models.text}
      />
      <VoiceSection
        value={config.voice}
        onChange={(p) => patch("voice", p)}
        model={loaded.models.realtime}
        voices={loaded.voices}
      />
      <DataAccessSection
        value={config.data}
        onChange={(p) => patch("data", p)}
        toolCategories={loaded.toolCategories}
      />
      <SafetySection
        data={config.data}
        safety={config.safety}
        onDataChange={(p) => patch("data", p)}
        onSafetyChange={(p) => patch("safety", p)}
      />
      <UsageSection value={config.usage} onChange={(p) => patch("usage", p)} />
      <MemorySection />
      <TestPublishBar
        status={status}
        env={loaded.env}
        dirty={dirty}
        busy={busy}
        saveMessage={saveMessage}
        saveError={saveError}
        onSaveDraft={() => submit("save_draft")}
        onPublish={() => submit("publish")}
        onRestore={() => submit("restore")}
      />
    </div>
  );
}
