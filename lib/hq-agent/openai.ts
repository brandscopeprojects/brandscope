import "server-only";

// Single server-side OpenAI client for the HQ Agent. The API key is read from
// process.env at construction and NEVER reaches the browser (this module is
// server-only). Callers must gate on hasOpenAiKey()/requireOpenAiKey() first.

import OpenAI from "openai";
import { requireOpenAiKey } from "./config";

let client: OpenAI | null = null;

export function openai(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: requireOpenAiKey() });
  }
  return client;
}

/** A stable per-user identifier for OpenAI safety/abuse signals (not PII). */
export function safetyIdentifier(profileId: string): string {
  return `bs-hq-${profileId}`;
}
