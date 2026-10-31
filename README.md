# Voice & Chat Agent Research

See [PROJECT.md](PROJECT.md) for what this product is and [docs/decisions](docs/decisions/) for what is decided.

Research notes for building a repeatable **chat + voice agent factory**: one shared engine, many client bots, built from a client's business data by Claude.

Collected 2026-10-28/29. Star counts, commit dates and licenses were checked live against GitHub and Hugging Face on that date. Re-check before relying on them (`scripts/check_licenses.sh`).

> **Not legal advice.** License notes reflect what each project *declares*. Have a lawyer review the final stack before selling it.

## Contents

| # | Doc | What it covers |
|---|---|---|
| 01 | [How website chatbots work](docs/01-how-chatbots-work.md) | Widget → backend → system prompt → LLM; how to tell an LLM bot from a scripted one |
| 02 | [Speed and routing](docs/02-speed-and-routing.md) | Why replies take under a second; router/triage pattern for junk vs real requests |
| 03 | [LFM3-Omni for voice](docs/03-lfm3-omni-voice.md) | Liquid AI's speech-to-speech model and the hands-free loop around it |
| 04 | [Bot factory architecture](docs/04-bot-factory-architecture.md) | Bot spec, Claude builder, runtime, channels, connectors, build order |
| 05 | [Open-source platforms](docs/05-oss-platforms.md) | Which OSS is maintained and licensed for multi-tenant resale |
| 06 | [Phone calls: LiveKit vs Pipecat](docs/06-phone-calls.md) | Telephony patterns, SIP vs media streams, gotchas |
| 07 | [Dictation apps](docs/07-dictation-apps.md) | Wispr Flow and its open-source alternatives |
| 08 | [Speech model licenses](docs/08-speech-model-licenses.md) | Commercial-safe STT, TTS, translation, diarisation, LLM |

## Recommended stack (summary)

| Layer | Pick | License |
|---|---|---|
| Channels + human inbox | Chatwoot | MIT (except `enterprise/`) |
| Bot logic | Langflow, or a thin custom engine | MIT |
| Voice + phone | LiveKit Agents + LiveKit SIP (Pipecat as alternative) | Apache-2.0 / BSD-2 |
| Phone numbers | Telnyx or Twilio SIP trunk | commercial service |
| Speech-to-text | Parakeet TDT v3, Whisper large-v3-turbo | CC-BY-4.0, MIT |
| Text-to-speech | Kokoro-82M, Chatterbox | Apache-2.0, MIT |
| Translation | MADLAD-400 3B | Apache-2.0 |
| Diarisation | pyannote 3.1 / community-1 | MIT / CC-BY-4.0 |
| VAD | Silero VAD | MIT |
| LLM | Open models only: LFM3, Qwen (see [decision 0001](docs/decisions/0001-open-models-only.md)) | Apache-2.0 / LFM license |
| Builder | Claude Agent SDK + MCP connectors | own code |
