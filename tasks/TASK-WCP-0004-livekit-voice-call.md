# TASK-WCP-0004 — LiveKit voice call

<!-- continuity:task {"acceptance":["Voice goes through LiveKit Agents, with Parakeet listening and Pocket TTS speaking, both hosted by us","The microphone is requested on Start, the spoken intro is one short line, and the caller can talk over it","Small talk such as 'can you hear me' gets a short reply and never goes to search","Each turn's timing is logged per step, and tests/voice-call.ts passes with real audio"],"depends_on":[],"goal":"Rebuild voice on LiveKit Agents with our own speech models","id":"WCP-0004","next_action":"Review PR #38 and merge it once CI passes","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Browser speech broke decision 0002 and failed the owner's live test on 2026-10-31: it couldn't hear, the intro was long, and small talk went to search"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Rebuild voice on LiveKit Agents with our own speech models.

## Why

Browser speech broke decision 0002 and failed the owner's live test on 2026-10-31: it couldn't hear, the intro was long, and small talk went to search.

## Allowed files

- `demo/live-site/speech/`, `demo/live-site/widget/sdk.ts`, `demo/live-site/server.ts`, `demo/live-site/build.ts`
- `demo/live-site/app/src/components/copilot/CopilotWidget.tsx`, `demo/live-site/app/src/lib/copilot.ts`
- `demo/live-site/package.json`, `demo/live-site/package-lock.json`, `demo/live-site/tests/voice-call.ts`
- this task file

## Human outcome

A caller can talk to the site and be heard. The voice is short and natural, it stops when they talk over it, and nothing they say leaves our own machines for speech.

## Scope and boundaries

- In scope: the voice path of the live demo site (listen, turn taking, speak) and its audio test.
- Out of scope: the copilot engine's rules, the tax site's flows, and a shared speech host for other agents (a later task).
- Dependencies/uncertainty: the audio test needs `livekit-server --dev`, `speech/server.py` and `speech/agent.py` running, so CI doesn't run it. The models aren't in git; `speech/requirements.txt` says where they come from.

## Acceptance criteria

- [x] Voice goes through LiveKit Agents, with Parakeet listening and Pocket TTS speaking, both hosted by us (commit `3b63058`).
- [x] The microphone is requested on Start, the spoken intro is one short line, and the caller can talk over it (commit `3b63058`).
- [x] Small talk gets a short reply and never goes to search (commit `3b63058`).
- [x] Each turn's timing goes to `speech/turns.jsonl`, and `tests/voice-call.ts` passes with real audio: 9/9, as reported by the session that wrote it.
- [ ] PR #38 passes required CI and merges.

## Evidence and sources

- Agent report in commit `3b63058` (not rerun for this record): `tests/voice-call.ts` 9/9. Small talk replies 0.75 to 0.8 s after the caller stops speaking, the intro takes 3.6 s, and barge-in stops the voice in about 0.36 s. `tests/tax-call.ts` 106/106.
- Observed 2026-11-01: the branch merges into `main` with no conflicts (`git merge-tree`), and `main` is merged in as `e40f316`.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #11; parent none; depends on none. Decision 0002 (#4) is the rule this restores.
- Primary writer / branch / source issue revision / as-of status: claude-code / `feat/11-livekit-voice-call` / issue #11 as of 2026-11-01 / open.
- Related PR/CI evidence and push receipt (request ID / SHA): PR #38; the receipt follows the checkpoint push.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 01:56:18 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["tasks/TASK-WCP-0004-livekit-voice-call.md","demo/live-site/speech/.gitignore"],"completed":["Pushed the LiveKit voice call (written 2026-10-31, never pushed) as feat/11-livekit-voice-call, merged main in, opened PR #38, added this task record, and made speech/.gitignore cover the venv and the models link"],"decisions":["Task ID WCP-0004, since WCP-0003 is the desk task on PR #37"],"evidence":["npm run check on a clean export of the branch: lint, ruff, typecheck and knip pass; 18/18 unit tests; 8/8 scenarios. Audio test 9/9 is the writing session's report in 3b63058, not rerun"],"evidence_class":"observed","next_action":"Review PR #38 and merge it once CI passes","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0004","timestamp":"2026-11-01T01:56:18Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"c8553dfcc6f41d3e3417367c74900e4fb4b973fb69d58db18c041f40a0147a1e","request_id":"973635a973e04f5d88c08be436c9466f","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0004"} -->

Completed:
- Pushed the LiveKit voice call (written 2026-10-31, never pushed) as feat/11-livekit-voice-call, merged main in, opened PR #38, added this task record, and made speech/.gitignore cover the venv and the models link

Evidence:
- npm run check on a clean export of the branch: lint, ruff, typecheck and knip pass; 18/18 unit tests; 8/8 scenarios. Audio test 9/9 is the writing session's report in 3b63058, not rerun

Decisions:
- Task ID WCP-0004, since WCP-0003 is the desk task on PR #37

Changed:
- tasks/TASK-WCP-0004-livekit-voice-call.md
- demo/live-site/speech/.gitignore

Blocked/uncertain:
- none

Next:
- Review PR #38 and merge it once CI passes

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
