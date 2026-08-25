# CopilotKit × Flowise POC

Chat interface (CopilotKit) wired to an existing Flowise agent (app.digiworks.ai)
via a custom adapter. Flowise no longer ships an official CopilotKit connector,
so the adapter uses CopilotKit's **factory mode**: it streams from the Flowise
prediction API (SSE) and translates it into AG-UI events.

## Architecture

```
┌─────────────────────────┐      AG-UI       ┌──────────────────────────┐     SSE      ┌────────────────────────────┐
│  React UI (Next.js)     │  ◄────────────►  │  /api/copilotkit route   │  ─────────►  │  Flowise prediction API    │
│  CopilotChat            │                  │  CopilotRuntime +        │              │  app.digiworks.ai/...      │
└─────────────────────────┘                  │  BuiltInAgent (custom)   │              └────────────────────────────┘
                                             └──────────────────────────┘
```

## Run

```bash
npm install
cp .env.example .env.local   # set FLOWISE_API_URL to your chatflow
npm run dev                  # http://localhost:3000
```

## Optional: test against the mock Flowise server

```bash
node scripts/mock-flowise.js                          # terminal 1 (port 4000)
FLOWISE_API_URL=http://localhost:4000/api/v1/prediction/mock npm run dev   # terminal 2
```

## Environment

| Var | Purpose |
|---|---|
| `FLOWISE_API_URL` | Full prediction URL of your chatflow/agentflow |
| `FLOWISE_API_KEY` | Optional chatflow API key (`Authorization: Bearer`) |
| `FLOWISE_SYSTEM_PROMPT` | Optional system prompt override (via `overrideConfig`) |

## How the adapter works

1. CopilotKit sends AG-UI `RunAgentInput` → factory extracts the last user
   message as `question`, previous messages as `history`
   (`userMessage`/`apiMessage` roles — Flowise's expected format), and uses
   `threadId` as Flowise `chatId` for session continuity.
2. POSTs to Flowise with `streaming: true` and parses the SSE stream.
3. `event:"token"` deltas → `text_message_content` events; `[DONE]` ends the
   run. Flowise's orchestration noise (`agentFlowEvent`, `nextAgentFlow`,
   `agentFlowExecutedData`, `metadata`) is ignored.

## Next.js compatibility patch

Next.js's flight loader rejects `export *` in client-boundary modules, and
`@copilotkit/react-core`'s v2 barrel uses two of them (re-exporting
`@copilotkit/core` and `@ag-ui/client`). `scripts/patch-copilotkit.mjs`
creates a patched copy of the barrel (those two lines removed — nothing the
app imports comes from them) and `next.config.mjs` aliases
`@copilotkit/react-core/v2` to it. Runs automatically via `postinstall`.

## Known issues / notes

- The chatflow `030fb876-b32f-4eae-9f5f-9622da61f70f` returns
  `500: No access token found in credential` — its LLM credential is broken
  on the cloud instance. Fix in Flowise UI: open the chatflow, re-select the
  credential on the model node, save.
- The chatflow `f32facf9-621d-47e0-b204-aecd14c590c4` (Salman Amin agent) works
  and is the default in `.env.local`.
