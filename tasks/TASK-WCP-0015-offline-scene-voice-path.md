# TASK-WCP-0015 — The offline scene suite finishes and says what it could not run

<!-- continuity:task {"acceptance":["A full offline run reaches its summary line instead of throwing","A scene the browser cannot run prints SKIP with the reason and is not counted as a pass","The layout scene's call checks are named for what they measure","A known failing check is recorded as a failure, not as a dead run"],"depends_on":[],"goal":"The offline scene suite runs to the end and says which scenes it could not run","id":"WCP-0015","next_action":"none; delivered in #70 and merged as 839a083","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"A full offline run stops in its voice scene, so it prints no summary and never reaches the phone layout scene (#69)"} -->

- Status: completed
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

The offline scene suite runs to the end and says which scenes it could not run.

## Why

A full offline run stops in its voice scene, so it prints no summary and never reaches the phone layout scene (#69). Every demo change since #61 has merged without a full end-to-end run.

## Allowed files

- `demo/live-site/tests/scenes.ts` only.

## Human outcome

One command tells a person whether the demo pages still work end to end, and names anything it could not check, instead of dying halfway and hiding the rest.

## Scope and boundaries

- In scope: the voice scene's handling of a browser that refuses the microphone, the summary line, the layout scene's check names, and the three other places where a check threw instead of failing (the tax submit, the tax-phone page load, the guide library).
- Out of scope: a real fake-media voice path (needs a local LiveKit server), the widget, the engine and the speech stacks.
- Dependencies/uncertainty: none. The cause arrived with #61; nothing here depends on it landing again.

## Acceptance criteria

- [x] `npm run test:offline` reaches `live-site (offline): 172/178 (5 skipped)` and ends without an uncaught error.
- [x] Where the browser refuses the microphone, the run prints `SKIP  voice: …` naming that reason, and the skip is counted separately from the passes.
- [x] The layout scene's call checks say what they measure ("call bar"), and the dead speech stub is gone.
- [x] The tax form's known submit failure (#19) is a recorded failure, and the run continues past it.

## Evidence and sources

- Before: run on `main` at `da521b8`, 2026-11-01 — the tax scene passed, then `== voice /clinic/book` logged `client voice: microphone: NotAllowedError` and the process ended with `page.waitForFunction: Timeout 30000ms exceeded` at `tests/scenes.ts:292`, before the summary and before the layout scene.
- After: `npm run test:offline` on this branch, 2026-11-01 — `live-site (offline): 172/178 (5 skipped) [keys 1/1, clinic 20/20, appliance 26/27, pricing 15/15, itdesk 17/17, pension 18/19, layout 32/32, tax-book 22/23, tax-desk 8/8, tax-phone 9/10, wait 4/6]`, then one line per skip.
- The six failures are all older than this change: two offline guide lookups ("warranty page 8", "processing time page 4"), the tax form's submit (#19), the FAQ list reading an empty document store, and two timing checks that expect a wait line the offline model answers too fast to show.

## Reproduction details (only when needed)

```
cd demo/live-site && npm run test:offline
```

Headless Chromium from the Playwright cache; no keys, no network.

## Related records

- Leaf #69; parent none; depends on none. Transferred here from #65's "voice tests pass" acceptance.

## Delivery

- Delivered in pull request #70, merged as `839a083` on 2026-11-01 07:18 UTC from pushed head `dafde79`; #69 closed on merge.
- Checks on the branch: `npm run check` passed (49 engine tests, 8 of 8 scenarios); `npm run test:offline` printed `live-site (offline): 172/178 (5 skipped)` with per-scene totals and one line per skip.
- The six failures are older than this change and stay open elsewhere: two offline guide lookups, the tax submit (#19), the FAQ list with no document store, and two timing checks.
- Primary writer / branch: claude-code / task/WCP-0015-offline-scene-voice-path; source issue open as of 2026-11-01.
- Related: #61 (moved calls to LiveKit, which left the stubs unused), #19 (the other offline scene failure).

## Checkpoint log

No checkpoints yet.

### 2026-11-01 07:17:09 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["demo/live-site/tests/scenes.ts, tasks/TASK-WCP-0015-offline-scene-voice-path.md, copilot-engine/ledger.jsonl"],"completed":["A full offline scene run used to die in its voice scene, so it printed no summary and never reached the phone layout checks; it now finishes, reports 172 of 178 checks, and names the five scenes it could not run."],"decisions":["no new decisions"],"evidence":["npm run test:offline on the branch printed live-site (offline): 172/178 (5 skipped) with per-scene totals and one line per skip; npm run check passed (49 engine tests, 8 of 8 scenarios); the six failures are all older than this change \u2014 two offline guide lookups, the tax submit (#19), the FAQ list with no document store, and two timing checks."],"next_action":"Open the pull request for the branch, merge it, then remove the worktree.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0015","timestamp":"2026-11-01T07:17:09Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"f9b336b0be6a39839dd15c644fea546c4afd3b7303028b1da476a537a09c7a9a","request_id":"72616343a2d848d5904e41528af70fcb","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0015"} -->

Completed:
- A full offline scene run used to die in its voice scene, so it printed no summary and never reached the phone layout checks; it now finishes, reports 172 of 178 checks, and names the five scenes it could not run.

Evidence:
- npm run test:offline on the branch printed live-site (offline): 172/178 (5 skipped) with per-scene totals and one line per skip; npm run check passed (49 engine tests, 8 of 8 scenarios); the six failures are all older than this change — two offline guide lookups, the tax submit (#19), the FAQ list with no document store, and two timing checks.

Decisions:
- no new decisions

Changed:
- demo/live-site/tests/scenes.ts, tasks/TASK-WCP-0015-offline-scene-voice-path.md, copilot-engine/ledger.jsonl

Blocked/uncertain:
- none

Next:
- Open the pull request for the branch, merge it, then remove the worktree.

### 2026-11-01 07:19:51 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["tasks/TASK-WCP-0015-offline-scene-voice-path.md, checkpoints/CURRENT.md"],"completed":["The offline scene suite stopped in its voice scene and printed no summary; it now finishes, reports 172 of 178 checks, and names the five scenes it could not run, so the task record is closed."],"decisions":["no new decisions"],"evidence":["Pull request #70 merged as 839a083; npm run check passed on the branch (49 engine tests, 8 of 8 scenarios); npm run test:offline printed live-site (offline): 172/178 (5 skipped) with one line per skip."],"next_action":"Find why the tax form never reaches its /sent page in the offline scene (#19), the one failing check the suite now records instead of dying on.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0015","timestamp":"2026-11-01T07:19:51Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"378295c67031d666f707e7e256410056edf2948a14a4f94c97dbb800bd8862fc","request_id":"730b537eedd445f49e506e9f60d746c6","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0015"} -->

Completed:
- The offline scene suite stopped in its voice scene and printed no summary; it now finishes, reports 172 of 178 checks, and names the five scenes it could not run, so the task record is closed.

Evidence:
- Pull request #70 merged as 839a083; npm run check passed on the branch (49 engine tests, 8 of 8 scenarios); npm run test:offline printed live-site (offline): 172/178 (5 skipped) with one line per skip.

Decisions:
- no new decisions

Changed:
- tasks/TASK-WCP-0015-offline-scene-voice-path.md, checkpoints/CURRENT.md

Blocked/uncertain:
- none

Next:
- Find why the tax form never reaches its /sent page in the offline scene (#19), the one failing check the suite now records instead of dying on.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
