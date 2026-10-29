# 06 · Phone calls: LiveKit Agents vs Pipecat

They're not either/or: Pipecat ships a LiveKit transport, so Pipecat pipelines can run on LiveKit's infrastructure.

| | LiveKit Agents | Pipecat |
|---|---|---|
| What it is | Agent framework + own media server (Apache-2.0) | Pipeline library, you choose the transport (BSD-2) |
| Phone | Built-in SIP server: [livekit/sip](https://github.com/livekit/sip) (Apache-2.0, active) | Provider connectors in repo: **Twilio, Telnyx, Plivo, Vonage, Exotel, Genesys** (WebSocket media streams) |
| Other transports | WebRTC | Daily, LiveKit, SmallWebRTC, WebSocket, **WhatsApp**, Vonage, plus avatar transports (Tavus, HeyGen) |
| Transfers / DTMF / outbound | Native SIP (REFER, warm transfer, dial-out) | Through the provider's REST API |
| Multi-tenant numbers | SIP dispatch rules → per-client agent | Your server maps number → bot |
| Scaling | Worker pool + load balancing built in | DIY, or Pipecat Cloud |
| Flexibility | Opinionated | Very modular |
| Fastest prototype | Medium | Fastest (Twilio → WebSocket → bot) |

## Connection patterns

**A) WebSocket media streams (simplest)**
```
Caller → Twilio/Telnyx number → Media Stream (WebSocket, 8 kHz μ-law) → Pipecat bot
```

**B) SIP trunk into LiveKit (production)**
```
Caller → SIP trunk (Telnyx/Twilio/Plivo) → LiveKit SIP → room → agent (LiveKit Agents or Pipecat)
```
You can swap trunk providers without code changes.

**C) Self-hosted phone system:** Asterisk, FreeSWITCH or [jambonz](https://github.com/jambonz/jambonz-feature-server) (MIT). Full control, but heavy operations work. Skip at first.

## Recommendation

1. Prototype: Twilio/Telnyx number → Pipecat over WebSocket.
2. Production: Telnyx (or Twilio) SIP trunk → LiveKit SIP → agents, one number per client via dispatch rules.
3. Twilio is easiest to start with. Telnyx is usually cheaper per minute and runs its own network.

## Gotchas

- Phone audio is **8 kHz**. Pick speech-to-text that handles phone audio, and test speech-to-speech models on real calls.
- Latency budget: under ~1 s. Use streaming STT/TTS, a fast LLM and tuned endpointing.
- Must-haves: human transfer, voicemail/answering-machine detection, recordings and transcripts, keypad fallback.
- Legal: recording consent (all-party states and countries), TCPA consent for outbound auto-dialing, AI disclosure where required.

## Sources

- https://www.forasoft.com/blog/article/pipecat-vs-livekit-agents
- https://livekit.io/field-guides/guide/livekit-vs-pipecat
- https://www.thoughtworks.com/radar/languages-and-frameworks/pipecat
- https://techsy.io/en/blog/best-open-source-voice-agent-frameworks
- https://www.plivo.com/blog/how-to-build-a-voice-ai-agent-livekit-pipecat-ten-or-native/
