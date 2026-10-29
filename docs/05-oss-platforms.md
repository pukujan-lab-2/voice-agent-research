# 05 · Open-source platforms

Requirement: mature, actively maintained, and **licensed for multi-tenant resale**. Stats checked on GitHub on 2026-10-29.

## Recommended

| Role | Project | Stars | Last commit | License |
|---|---|---|---|---|
| Channels + human inbox (web widget, WhatsApp, email, handoff) | [Chatwoot](https://github.com/chatwoot/chatwoot) | 38.5k | 2026-10-29 | MIT (except `enterprise/`) |
| Bot logic (prompts, RAG, tools, API) | [Langflow](https://github.com/langflow-ai/langflow) | 156k | 2026-10-29 | MIT |
| Voice + phone | [LiveKit Agents](https://github.com/livekit/agents) + [LiveKit server](https://github.com/livekit/livekit) | 15k / 21.9k | 2026-10-29 | Apache-2.0 |
| Voice (alternative) | [Pipecat](https://github.com/pipecat-ai/pipecat) | 16.9k | 2026-10-29 | BSD-2 |
| Builder | Claude Agent SDK + MCP connectors | n/a | n/a | own code |

```
Client docs/site ──► Claude builder ──► Langflow flow (JSON, via API) + KB upload
                                              │
Web widget / WhatsApp / email ──► Chatwoot ───┤ (Agent Bot webhook)
Phone / browser voice ──────────► LiveKit Agents ┘ (same flow/tools)
                                              │
                         Human takes over in Chatwoot when needed
```

**Caveat:** Langflow is a visual flow builder. Generated flow JSON can be fragile. The fallback is a thin custom engine inside LiveKit Agents, with Chatwoot kept for channels.

## Avoid for this use

| Project | Stars | Why |
|---|---|---|
| [Flowise](https://github.com/FlowiseAI/Flowise) | 55.5k | **Archived** on GitHub (last push 2026-08-13) |
| [Dify](https://github.com/langgenius/dify) | 160k | Modified Apache: **no multi-tenant service without a commercial license**, and you can't remove its logo from the frontend |
| [n8n](https://github.com/n8n-io/n8n) | 209k | Sustainable Use License: internal or non-commercial use only |
| [Typebot](https://github.com/baptisteArno/typebot.io) | 10.6k | FSL-1.1: no competing commercial use |
| [TEN Framework](https://github.com/TEN-framework/ten-framework) | 11.2k | No on-device hosting and no competing with Agora |
| [Botpress](https://github.com/botpress/botpress) | 15k | Repo is now SDK/integrations for their cloud. Self-hosting means the old v12. |
| [Rasa](https://github.com/RasaHQ/rasa) | 21.4k | Last push 2026-07-24, slowing. Fixed-flow (intent) design. |

## Closed competitors

Vapi, Retell, Voiceflow, Intercom Fin. Open-source Vapi-style projects: Dograh, Bolna (maturity not checked).
