# TASK-WCP-0124 — Stt Stream

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"Listen while the caller talks, and know how many calls one speech server takes","id":"WCP-0124","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/172","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"unassigned","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The speech server heard a turn only after it ended, and calls at once on one Pro were never measured (#172)"} -->

- Status: active
- Owner: unassigned
- Priority: P2
- Depends on: none

## Goal

Listen while the caller talks, and know how many calls one speech server takes

## Why

The speech server heard a turn only after it ended, and calls at once on one Pro were never measured (#172)

## Allowed files

- define bounded paths before implementation.

## Human outcome

Describe what becomes easier, safer, clearer, or possible when this task is complete.

## Scope and boundaries

- In scope:
- Out of scope:
- Dependencies/uncertainty:

## Acceptance criteria

- [ ] state observable, task-specific outcomes.

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none):
- Primary writer / branch / source issue revision / as-of status:
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

### 2026-11-07 22:06:10 UTC — claude-opus-5-5

<!-- continuity:checkpoint {"agent":"claude-opus-5-5","blocked":[],"changed":["demo/live-site/speech/server.py, stt_stream.py, tests/test_stt_stream.py, docs/scaling-limits.md"],"completed":["/stt/stream WebSocket, SPEECH_DEVICE, tests, capacity and stack timings in docs/scaling-limits.md"],"decisions":["no new decisions"],"evidence":["npm run test:speech 33 pass; end to end 2.22 s median streaming vs 2.51 s upload (1 call)"],"next_action":"Merge PR #173, then nurse-screen #77 once the Pro runs it","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0124","timestamp":"2026-11-07T22:06:10Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"abbf2ecdc32a824d54e5ef27c6ea1a5c75f6419dad0ddb0aef1014c04b23970d","request_id":"5b76d1fe127b4f3bb55aae7c8cca66d3","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0124"} -->

Completed:
- /stt/stream WebSocket, SPEECH_DEVICE, tests, capacity and stack timings in docs/scaling-limits.md

Evidence:
- npm run test:speech 33 pass; end to end 2.22 s median streaming vs 2.51 s upload (1 call)

Decisions:
- no new decisions

Changed:
- demo/live-site/speech/server.py, stt_stream.py, tests/test_stt_stream.py, docs/scaling-limits.md

Blocked/uncertain:
- none

Next:
- Merge PR #173, then nurse-screen #77 once the Pro runs it

### 2026-11-07 22:12:24 UTC — claude-opus-5-5

<!-- continuity:checkpoint {"agent":"claude-opus-5-5","blocked":[],"changed":["docs/scaling-limits.md"],"completed":["Whisper large-v3-turbo timed on the Windows RTX 4060: 297 ms median per turn, none of 13 misheard"],"decisions":["no new decisions"],"evidence":["faster-whisper 1.2.1 float16 on the 13 knockout caller lines; 3 at once 889 ms each"],"next_action":"Merge PR #173, then nurse-screen #77 once the Pro runs it","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0124","timestamp":"2026-11-07T22:12:24Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"1618276d8e68504633fc2ecdd0a52fc912e46bb5d19479772ee2ffeb8fd753ee","request_id":"90e2d2f1865d4e0cab1dbce35e9a86f8","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0124"} -->

Completed:
- Whisper large-v3-turbo timed on the Windows RTX 4060: 297 ms median per turn, none of 13 misheard

Evidence:
- faster-whisper 1.2.1 float16 on the 13 knockout caller lines; 3 at once 889 ms each

Decisions:
- no new decisions

Changed:
- docs/scaling-limits.md

Blocked/uncertain:
- none

Next:
- Merge PR #173, then nurse-screen #77 once the Pro runs it

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
