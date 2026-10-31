# 0002. Voice runs on LiveKit Agents

**Status:** Accepted · **Date:** 2026-10-29

## Decision

Voice (and later phone calls) runs on LiveKit Agents (Apache-2.0), with Pipecat (BSD-2) as the fallback. Speech-to-text and text-to-speech are open models we host: LFM3-Audio or faster-whisper/Parakeet to listen, Pocket TTS (Kokoro as backup) to speak. Browser speech APIs are not allowed.

## Why

It's mature, community-maintained OSS that handles turn-taking, barge-in, and phone calls over SIP. Browser speech sends audio to Google, fails in Brave and Chromium builds, and sounds robotic. It failed the owner's live test on 2026-10-31.

## Consequences

The demo widget's `SpeechRecognition`/`speechSynthesis` code is drift from this decision and is being replaced. Sources: `docs/04-bot-factory-architecture.md`, `docs/05-oss-platforms.md`.
