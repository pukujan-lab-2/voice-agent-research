# TASK-WCP-0019 — One automated test suite for every voice config

<!-- continuity:task {"acceptance":["tests/voice-matrix.ts runs every stack in speech/stacks.json (or a named subset) one at a time, so the speech server swaps models","Per stack and language: word error rate on human-transcribed speech (Google FLEURS, Multilingual LibriSpeech), its voice heard back by Whisper, and time to first sound","tests/voice-tools.ts runs on every stack","Each case is a Phoenix trace through Octo with its audio stored in Octo files and linked from the span","The text model can be another machine's LFM3 over an SSH tunnel (--llama-host)","The report lists every stack by language and is posted on #82"],"depends_on":[],"goal":"One automated test suite scores every voice config, with audio in Phoenix","id":"WCP-0019","next_action":"Post the full run's report on #82 and open the pull request","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The lab's rule is that every version is tested so anyone can pick one, but only two of five voice stacks had real-audio or tool-calling tests and no audio reached Phoenix (#82)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

One automated test suite scores every voice config, with audio in Phoenix.

## Why

PROJECT.md rule 8 says every module is tested so the owner, a business or a visitor can pick one. Only two of the five voice stacks had real-audio tests, two had tool-calling tests, nothing scored hearing or speaking per language, and no audio reached Phoenix (#82).

## Allowed files

- `demo/live-site/tests/voice-matrix.ts` (new)
- `demo/live-site/tests/voice-tools.ts`
- `demo/live-site/package.json` (a script for the suite)
- `tasks/TASK-WCP-0019-voice-matrix.md`

## Human outcome

The owner runs one command and gets, for every stack and language, how well it hears, how well its voice is understood, how fast it starts speaking and how well its model calls tools, and can play any failing clip from Phoenix.

## Scope and boundaries

- In scope: the runner, widening the tool-calling test, reference speech datasets, Octo audio and Phoenix spans for test cases.
- Out of scope: recording live calls' audio, new stacks, the browser and LiveKit path (tests/voice-call.ts and tests/voice-languages.ts cover it).

## Acceptance criteria

- [x] One command runs every stack, one at a time.
- [x] Hearing, speaking and first-sound scores per stack and language.
- [x] The tool-calling test runs on every stack.
- [x] Phoenix spans with audio links in Octo (smoke run checked through Octo's trace read).
- [x] `--llama-host mac-pro|windows` reaches LFM3 over an SSH tunnel.
- [ ] The full run's report is posted on #82.

## Evidence and sources

- Smoke run 2026-11-01 on `english-fast`: hears 9% word errors on FLEURS English, its voice heard back at 2%, first sound 109 ms, tools 8/8 and outcomes 10/10 with LFM3 on the Pro.
- MINDS-14 was tried first and dropped: its transcripts are machine-made ("Henry County" for "wondering how I would").

## Related records

- Leaf #82; parent none; depends on #71 (closed); related #17, #55, decision 0012.
- Primary writer / branch: claude-code / `test/82-voice-matrix`; source issue open as of 2026-11-01.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 08:42:36 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["tests/voice-matrix.ts scores every voice stack per language (hearing on FLEURS and MLS, its voice heard back by Whisper, first sound, tool calls) with Phoenix traces and audio in Octo; voice-tools.ts runs on any stack"],"decisions":["no new decisions"],"evidence":["npm run check passes; smoke run on english-fast: hears 9% WER, speaks 2%, first sound 109 ms, tools 8/8 and outcomes 10/10 with LFM3 on the Pro; spans read back through Octo with audio file ids"],"next_action":"Post the full five-stack run's report on #82","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0019","timestamp":"2026-11-01T08:42:36Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"c5e9d25b3783748eb1e777aef90607c715d4d191d2d6c5503e9eb08b99b166bf","request_id":"dc6d216c1e2d43fc8cc3b96e16c0e582","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0019"} -->

Completed:
- tests/voice-matrix.ts scores every voice stack per language (hearing on FLEURS and MLS, its voice heard back by Whisper, first sound, tool calls) with Phoenix traces and audio in Octo; voice-tools.ts runs on any stack

Evidence:
- npm run check passes; smoke run on english-fast: hears 9% WER, speaks 2%, first sound 109 ms, tools 8/8 and outcomes 10/10 with LFM3 on the Pro; spans read back through Octo with audio file ids

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Post the full five-stack run's report on #82

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
