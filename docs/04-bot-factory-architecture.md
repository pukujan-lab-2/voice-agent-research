# 04 · Bot factory architecture

Goal: a repeatable chat + voice agent factory that anyone can integrate, where Claude takes a client's business requirements and data and produces a working, tested bot.

**Core idea: a bot is configuration, not code.** One engine runs every client's bot.

```
Client data (website, PDFs, prices, FAQs, CRM)
        │
        ▼
[Builder]  Claude (Agent SDK): ingest →
           bot spec + knowledge base + test conversations → run evals → human approves
        │
        ▼
bot-spec.yaml ── persona, goals, guardrails, router rules,
                 knowledge refs, tools, channels
        │
        ▼
[Runtime]  one engine, many bots (looked up by bot_id)
           router → agent → tools
        │
   ┌────┼──────────────┬───────────────┐
   ▼    ▼              ▼               ▼
 Web   Voice         WhatsApp/SMS     REST API / MCP
widget (LiveKit/Pipecat; phone via SIP trunk)
```

## Example bot spec

```yaml
bot: acme-dental
persona: {name: "Ava", tone: "warm, concise", languages: [en, es]}
goals: [answer_questions, book_appointment, capture_lead]
guardrails:
  off_topic: brush_off
  never: [medical_advice, exact_quotes_without_range]
knowledge: [kb://acme-dental/services, kb://acme-dental/faq]
tools:
  - book_appointment: {provider: calcom}
  - create_lead: {provider: hubspot}
  - handoff_human: {channel: chatwoot}
channels:
  web: true
  voice: {phone: "+1...", tts_voice: kokoro/af_heart}
  whatsapp: false
models: {router: fast, main: fast, escalate: smart}
```

## Components to build

1. **Bot spec format:** the contract between builder and engine.
2. **Builder agent:** crawls the site, reads files, drafts the spec, generates test conversations (trolls, typos, pricing, booking) and runs them before publish. Keep a human approval step.
3. **Connector library:** calendar, CRM, Stripe, Shopify, generic webhook. Build them as **MCP servers** so Claude uses the same connectors while building and while running. For custom client systems, Claude writes a connector from their API docs and tests it in a sandbox, then you review it.
4. **Evals + dashboard:** transcripts, leads, flagged failures. Claude suggests prompt fixes, and you approve them.

## Voice design choice

- **Cascade (STT → LLM → TTS):** works with any LLM including Claude, reliable tool calling, easier to control. **Start here.**
- **Speech-to-speech (e.g. LFM3-Omni):** lower latency, cheap to self-host, weaker tool use. Add later for simple, high-volume calls.

## Must-haves

- Strict tenant isolation (each bot sees only its own knowledge base and tools)
- API keys in a vault, never in the spec
- Treat uploaded docs and crawled sites as untrusted (prompt injection)
- Rate limits and a spending cap per tenant
- Voice: call-recording consent laws

## Build order

1. Engine + spec format + web widget + one hand-built example bot
2. Builder: Claude ingests data → spec → evals
3. Connectors (calendar, CRM, webhook)
4. Voice via LiveKit Agents or Pipecat
5. Self-serve dashboard + billing

## Positioning

Clients can already buy Vapi, Retell, Voiceflow and Intercom Fin. The differentiator is **"send your docs, get a tested bot in minutes"**, not "we build bots".
