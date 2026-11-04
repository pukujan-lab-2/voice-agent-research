# TASK-WCP-0109 — Trace Pointers

<!-- continuity:task {"acceptance":["A trace carries a pointer to the encrypted call record, never the caller's words or the reply","Each business's config sets how long its calls are kept; a sweeper deletes calls past that age","A plain-code test: Phoenix spans hold no transcript text, and a call past its business's retention can no longer be read"],"depends_on":["WCP-0108"],"goal":"Keep call text out of traces and delete each business's calls on its own schedule","id":"WCP-0109","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/129","next_action":"open the pull request with Closes #129, confirm CI is green and arm auto-merge","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Every turn's trace carries what the caller said and the reply in full, and Phoenix is shared and unencrypted, so the words escape the locked record; nothing deletes a business's calls by age (#129, decision 0021 settlement 3)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: WCP-0108 (#128, merged)

## Goal

Keep call text out of traces and delete each business's calls on its own schedule

## Why

Every turn's trace carries what the caller said and the reply in full, and Phoenix is shared and unencrypted, so the words escape the locked record; nothing deletes a business's calls by age (#129, decision 0021 settlement 3)

## Allowed files

- copilot-engine/src/call-records.ts
- copilot-engine/src/site-config.ts
- copilot-engine/tests/site-config.test.ts
- demo/live-site/api.ts
- demo/live-site/server.ts
- demo/live-site/tracing.ts
- demo/live-site/speech/telemetry.py
- demo/live-site/speech/tests/test_telemetry.py
- demo/live-site/tests/own-workspace.test.ts
- tasks/TASK-WCP-0109-trace-pointers.md

## Human outcome

Phoenix no longer shows what a caller said or what was answered: the words sit in the call's locked record in the business's own workspace, and each business decides how many days they are kept before they are deleted.

## Scope and boundaries

- In scope: the text attributes of page and voice-agent spans, the locked call record they move to, `retention.days` in a business's config, the hourly sweeper, tests.
- Out of scope: evals and replays that read Phoenix text (phase 4), call audio (#130), who may read a record (#131), deleting by key (#132).
- Dependencies/uncertainty: the voice agent's turn spans now carry only character counts; the page's span of the same turn (same turn.id) holds the pointer.

## Acceptance criteria

- [ ] A trace carries a pointer to the encrypted call record, never the caller's words or the reply
- [ ] Each business's config sets how long its calls are kept; a sweeper deletes calls past that age
- [ ] A plain-code test: Phoenix spans hold no transcript text, and a call past its business's retention can no longer be read

## Evidence and sources

Starting revision ba29fe2 (main after #128). Tests: `demo/live-site/tests/own-workspace.test.ts` (no span holds the words, the pointer opens, retention and sweep), `copilot-engine/tests/site-config.test.ts` (retention validation), `demo/live-site/speech/tests/test_telemetry.py` (voice turn spans).

## Reproduction details (only when needed)

Not needed.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #129; parent #121; depends on #128 (merged)
- Primary writer / branch / source issue revision / as-of status: Claude Code side session of local_a2ffa57e / task/WCP-0109-trace-pointers / #129 as filed 2026-11-04 / active
- Related PR/CI evidence and push receipt (request ID / SHA): pending

## Checkpoint log

No checkpoints yet.

### 2026-11-04 23:15:42 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/call-records.ts, demo/live-site/api.ts, demo/live-site/tracing.ts, demo/live-site/server.ts, demo/live-site/speech/telemetry.py, copilot-engine/src/site-config.ts, tests"],"completed":["Call text moved out of traces into the locked call record; retention.days per business with an hourly sweep"],"decisions":["Voice agent turn spans keep character counts only; the page span of the same turn holds the pointer"],"evidence":["npm run check passes; own-workspace tests show no span holds the words, the pointer opens for its business, and entries past retention are unread and swept"],"next_action":"Open the PR with Closes #129 and arm auto-merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0109","timestamp":"2026-11-04T23:15:42Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"fb705d488bbbff29c9892e8ba842086e6665d21c969a9a966e5ce516471d03a9","request_id":"e045b758ca1d47798cc00d83130b1a44","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0109"} -->

Completed:
- Call text moved out of traces into the locked call record; retention.days per business with an hourly sweep

Evidence:
- npm run check passes; own-workspace tests show no span holds the words, the pointer opens for its business, and entries past retention are unread and swept

Decisions:
- Voice agent turn spans keep character counts only; the page span of the same turn holds the pointer

Changed:
- copilot-engine/src/call-records.ts, demo/live-site/api.ts, demo/live-site/tracing.ts, demo/live-site/server.ts, demo/live-site/speech/telemetry.py, copilot-engine/src/site-config.ts, tests

Blocked/uncertain:
- none

Next:
- Open the PR with Closes #129 and arm auto-merge

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
