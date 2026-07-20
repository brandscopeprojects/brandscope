# HQ Agent — internal executive intelligence

The HQ Agent is the internal, management-only assistant for asking questions about
the Brandscope **business** (customers, revenue, operations, AI usage, provider
health). It supports **typed text chat** (OpenAI Responses API, streamed) and
**natural realtime voice** (OpenAI Realtime API over WebRTC). It answers only from
verified application data through an approved server-side tool layer, and says so
plainly when data is missing — it never fabricates metrics.

## Feature overview

- **Text chat** — `gpt-4o-mini` (configurable), streamed token-by-token, with a
  server-side tool loop over a narrow read-only tool registry, safe Markdown
  rendering (no raw HTML), copy + thumbs feedback, and a "Data used" sources
  disclosure.
- **Voice** — a circular waveform button opens a live WebRTC conversation on
  `gpt-realtime-2.1-mini` (configurable). The user speaks and hears replies, can
  interrupt, sees a live transcript, and the transcript is saved into the same
  conversation. The permanent OpenAI key never reaches the browser.
- **Config screen** — `/brandscope-admin/settings`: identity, instructions, text,
  voice, data-access toggles, safety, usage limits, and test/publish.

## Required environment variables

| Variable | Where | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Server (Vercel) | Text + voice. **Never sent to the browser.** |
| `OPENAI_TEXT_MODEL` | Server (optional) | Text model id. Default `gpt-4o-mini`. |
| `OPENAI_REALTIME_MODEL` | Server (optional) | Realtime model id. Default `gpt-realtime-2.1-mini`. |

Do not commit secret values. `validateHqEnv()` (`lib/hq-agent/config.ts`) reports
missing required vars; the config screen surfaces a banner when the key is absent,
and every endpoint returns an honest `503` rather than crashing.

## Local development

1. Set `OPENAI_API_KEY` (and optionally the two model vars) in `.env.local`.
2. `npm run dev`, then open `/brandscope-admin/chat` as an `internal_admin` /
   `super_admin` user.
3. **Microphone requires HTTPS** (or `localhost`). Voice will not connect on a
   plain-HTTP LAN address — browsers block `getUserMedia` there.
4. `npm run test` runs the Vitest suite; `npm run typecheck` and `npm run build`
   must pass before shipping.

## Vercel deployment notes

- Set `OPENAI_API_KEY` (required) and optionally `OPENAI_TEXT_MODEL` /
  `OPENAI_REALTIME_MODEL` in the Vercel project env. Model names can be changed
  later purely through env — no code change.
- The app is served over HTTPS on Vercel, so microphone access works in production.
- No WebSocket server is hosted on Vercel: the browser talks WebRTC **directly** to
  OpenAI using a short-lived ephemeral key minted by our server route.

## Realtime security model

1. Browser calls `POST /api/hq-agent/realtime/session` (internal-admin gated).
2. The server mints a **short-lived** client secret via the OpenAI SDK
   (`realtime.clientSecrets.create`, TTL 600s) with the session config
   (voice instructions, turn detection, transcription, approved tools) and an
   `OpenAI-Safety-Identifier`.
3. Only the ephemeral `value` (`ek_…`) + safe session metadata is returned to the
   browser. The permanent `OPENAI_API_KEY` is never in any JS bundle, response or
   log.
4. The browser establishes WebRTC by POSTing its SDP offer to
   `https://api.openai.com/v1/realtime/calls` with the ephemeral key.
5. When the model requests a tool over the data channel, the browser forwards it to
   `POST /api/hq-agent/realtime/tool`, which runs the SAME server-side registry as
   text chat and returns the result. Tools never run in the browser.

## Business-tool architecture

- The model may only call **narrow, typed, read-only** tools in
  `lib/hq-agent/tools/` — it never generates SQL or queries arbitrary tables.
- Each tool: strict input schema + server-side validation, category-based
  enable/disable, a `run(ctx, args)` returning `{ data, dataUpdatedAt, sources,
  notAvailable? }`, an 8s timeout + one retry, and a `hq_tool_runs` log row (name,
  duration, success — never payloads or secrets).
- Tools with **no data source yet** (e.g. `get_campaign_performance`) return
  `notAvailable: true` — the agent says the module isn't integrated rather than
  inventing numbers.
- The registry is filtered by the config's enabled categories before tools are
  offered to the model.

### How to add a new HQ tool

1. Create/extend a file in `lib/hq-agent/tools/` exporting an `HqTool` (see
   `subscriptions.ts` for the smallest example): `name`, `category`, `description`,
   `parameters` (JSON Schema), `validate(raw)`, `run(ctx, args)`.
2. Return real data with `dataUpdatedAt` + `sources`. If the source doesn't exist
   yet, return `{ notAvailable: true }` and a `TODO(integration)` comment — do not
   fabricate.
3. Add the tool's array to the concatenation in `tools/registry.ts`.
4. If it needs a new category, add it to `ToolCategory` (`types.ts`) and the
   defaults in `config.ts`.

## Conversation persistence

- `hq_conversations` / `hq_messages` hold the shared text+voice thread; each message
  records its `modality`. Voice transcript turns are saved via
  `POST /api/hq-agent/conversations`.
- A recent-message window (`config.text.recentMessageLimit`) bounds what is resent
  to the model.
- `hq_agent_memory` holds owner-curated facts injected into the system prompt (the
  agent never writes it). `hq_agent_config` holds the draft/published config
  document. `hq_tool_runs` holds per-tool + per-voice-session telemetry.
- All HQ tables are Class-2 service-role-only (RLS enabled, no policies); the
  management gate is enforced in the app layer (`getInternalCtx`).

## Test instructions

- `npm run test` — Vitest. Covers tool input validation, config clamping,
  env validation, the system prompt, and route authorisation (chat + realtime
  session reject non-admins; missing-key returns 503). OpenAI is never called in
  tests.

## Known limitations

- **Campaign performance** has no real data source — the tool returns
  not-available. Wire a real source before relying on campaign answers.
- **Customer risk** scores are a labelled heuristic, not a prediction.
- Voice requires a modern WebRTC browser + microphone permission + HTTPS.
- Provider/model spend is metered by recorded usage; exact cost depends on
  configured pricing and is not asserted as billing truth.

## Production checklist

- [ ] `OPENAI_API_KEY` set in the deployment environment (never in the repo).
- [ ] Optional: `OPENAI_TEXT_MODEL` / `OPENAI_REALTIME_MODEL` overrides set.
- [ ] Served over HTTPS (microphone).
- [ ] `npm run typecheck && npm run lint && npm run build && npm run test` all pass.
- [ ] Config published from `/brandscope-admin/settings` (or defaults accepted).
- [ ] Verified an authorised admin can chat + start a voice session; an
      unauthorised user is blocked from the page and every endpoint.
