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

### 2026-11-08 00:18:57 UTC — claude-opus-5-5

<!-- continuity:checkpoint {"agent":"claude-opus-5-5","blocked":[],"changed":["none"],"completed":["The speech server counts calls with leases and unloads when idle, and runs Whisper and Kokoro on the Windows GPU (branch feat/speech-hosts, stacked on #173, not yet a PR)."],"decisions":["no new decisions"],"evidence":["37 speech tests pass; Windows: Whisper about 0.35 s, Kokoro first audio 0.55-0.67 s, English lines only."],"next_action":"Plan the shared speech gateway here (owner, 2026-11-07: voice-agent-research owns the pipelines), then one English and one Spanish bot call through the Windows GPU.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0124","timestamp":"2026-11-08T00:18:57Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"5d1cd6a0fa0885040acbd377c2d589da891a84d37975a1bb9a61daba004aeda2","request_id":"db460d0e1c844bf6a78f629b710ba3c7","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0124"} -->

Completed:
- The speech server counts calls with leases and unloads when idle, and runs Whisper and Kokoro on the Windows GPU (branch feat/speech-hosts, stacked on #173, not yet a PR).

Evidence:
- 37 speech tests pass; Windows: Whisper about 0.35 s, Kokoro first audio 0.55-0.67 s, English lines only.

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Plan the shared speech gateway here (owner, 2026-11-07: voice-agent-research owns the pipelines), then one English and one Spanish bot call through the Windows GPU.

### 2026-11-08 00:57:01 UTC — claude-opus-5-5

<!-- continuity:checkpoint {"agent":"claude-opus-5-5","blocked":[],"changed":["none"],"completed":["Speech gateway PR #175 opened (stacked on #174); stale keep-alive retry fix; bot calls 1/3/5 through a test gateway split Pro/Windows/cloud as routed"],"decisions":["no new decisions"],"evidence":["PR #175 comment 6715323630; npm run test:gateway 18 OK"],"next_action":"Fix clipped first words in Spanish listening on Windows; move copilot, Maybe Home, NYC map, Precedent to the gateway after #174/#175 and server-management #157 merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0124","timestamp":"2026-11-08T00:57:01Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"d8bd54cfb15a28d36771a785a7c2d8b7c5d6cf87c2833db2d9f4825caf1bf931","request_id":"8742a2592bf04a91bfa87066d4a28faa","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0124"} -->

Completed:
- Speech gateway PR #175 opened (stacked on #174); stale keep-alive retry fix; bot calls 1/3/5 through a test gateway split Pro/Windows/cloud as routed

Evidence:
- PR #175 comment 6715323630; npm run test:gateway 18 OK

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Fix clipped first words in Spanish listening on Windows; move copilot, Maybe Home, NYC map, Precedent to the gateway after #174/#175 and server-management #157 merge

### 2026-11-08 02:46:09 UTC — claude-opus-5-5

<!-- continuity:checkpoint {"agent":"claude-opus-5-5","blocked":["tailnet access rules allow only 6767/6787 into the Windows PC, so the gateway cannot reach 6799; Spanish goes to the Pro until the owner allows 6799"],"changed":["none"],"completed":["Speech server and gateway merged as #176 (replacing #174/#175); gateway deployed on the VPS (Komodo stack speech-gateway, server-management #158); Windows RileySpeech task installed"],"decisions":["no new decisions"],"evidence":["PR #176 merged; gateway /health shows the Pro up; Windows 127.0.0.1:8799 /health 200"],"next_action":"Owner allows port 6799 to agents in the tailnet rules; then move copilot, Maybe Home, NYC map and Precedent to the gateway","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0124","timestamp":"2026-11-08T02:46:09Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"321fe9fe0d0bbae086fd6cd7e152a8c17d49595c27d1cdeb5dd279336a15c90f","request_id":"82a54e15e2d84f08aa227f0c75551e70","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0124"} -->

Completed:
- Speech server and gateway merged as #176 (replacing #174/#175); gateway deployed on the VPS (Komodo stack speech-gateway, server-management #158); Windows RileySpeech task installed

Evidence:
- PR #176 merged; gateway /health shows the Pro up; Windows 127.0.0.1:8799 /health 200

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- tailnet access rules allow only 6767/6787 into the Windows PC, so the gateway cannot reach 6799; Spanish goes to the Pro until the owner allows 6799

Next:
- Owner allows port 6799 to agents in the tailnet rules; then move copilot, Maybe Home, NYC map and Precedent to the gateway

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
