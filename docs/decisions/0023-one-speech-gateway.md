# 0023. One speech gateway serves every live call

**Status:** Accepted · **Date:** 2026-11-07

## Decision

Our speech models are hosted once and every project reaches them through one gateway on the VPS
([docs/speech-gateway.md](../speech-gateway.md)). This lab owns it: the gateway, its routes file and the client headers
live here; server-management only records where it runs.

- **Self-hosted first.** English goes to the Pro; every other language to the Windows PC's RTX 4060 (Whisper
  large-v3-turbo and Kokoro); a full server is passed over; when all are full each project's own fallback takes the call.
- **Routing is one file,** `demo/live-site/speech/gateway/routes.toml`, read again when it changes.
- **The route is picked when the call starts and again when the caller picks a language** (on the phone Riley asks; on
  a site the visitor picks or clicks), and a call stays on one server between picks.
- **The gateway warms a project's stacks** when its site is opened or a call starts, so the first turn isn't a cold load.

## Why

The owner, 2026-11-07: "host once serve many, for multiple project ... copyable for future projects too once setup, and
an easy config file to switch routing easily and upgrade when needed", for the Design Bakery live call, a future business
agent and the Maybe Home agent; "route all multilingual to windows by default, while pro for english ... based on call
volume"; self-hosted first because it saves money (a budget of about $10 a month at 3 to 4 calls at once).

One server serves about two calls at once (docs/scaling-limits.md), so a second server and a router are what lets 3 to
4 calls stay self-hosted. Before this each project wired itself to the Pro by hand (two socat bridges, a pinned
network), and only Riley knew about the Windows PC.

## Consequences

- A project points `SPEECH_URL` at the gateway and sends `X-Speech-Project` and `X-Speech-Call`; nothing else changes.
- The per-project speech bridges go once every project has moved.
- The gateway is one more hop on the VPS (loopback) and a single point: when it is down a project's speech requests fail
  and its own fallback takes over, as when the Pro is asleep today.
- The Windows PC is shared with its owner's own work: its speech server unloads after 5 idle minutes and the gateway's
  warm loads it again ahead of a call.
