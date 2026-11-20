# TASK-WCP-0127 — Desk Timeout Reason

<!-- continuity:task {"acceptance":["A walk the budget ended reports timeout even when the timer fires before the clock reads the deadline","The flaky test no longer depends on the wall clock","npm run check passes"],"depends_on":[],"goal":"A smart-slot walk that the time budget ended reports timeout, never exhausted","id":"WCP-0127","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/188","next_action":"Merge; the next deploy carries the fix","owner":"Claude","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The walk re-read the clock to decide the reason, and a timer can fire a millisecond before the clock reaches the deadline, so a timed-out call was reported as every route failing"} -->

- Status: active
- Owner: Claude
- Priority: P1
- Depends on: none

## Goal

A smart-slot walk that the time budget ended reports timeout, never exhausted

## Why

The walk re-read the clock to decide the reason, and a timer can fire a millisecond before the clock reaches the deadline, so a timed-out call was reported as every route failing

## Allowed files

- `demo/live-site/smart.ts`, `demo/live-site/api.ts`, `demo/live-site/tests/smart-desk.test.ts`

## Human outcome

A smart-slot call that runs out of time is reported as a timeout, in the 409 reply and the log, instead of as every route failing; and CI stops failing on it by chance.

## Scope and boundaries

- In scope: how the walk decides its failure reason, and the test's clock.
- Out of scope: the routes, the budget's length and the daily cap.
- Dependencies/uncertainty: none.

## Acceptance criteria

- [x] A walk the budget ended reports timeout even when the timer fires before the clock reads the deadline.
- [x] The flaky test no longer depends on the wall clock.
- [x] npm run check passes.

## Evidence and sources

The cause is in `demo/live-site/smart.ts` on `main` at e536e16: the walk catches its own deadline timer, then decides the reason again with `Date.now() >= deadline`. A Node timer can fire up to about a millisecond before `Date.now()` reaches the deadline; in 60 of 2000 tries a 2 ms timer fired with the clock still short. A script calling the unchanged code reported `exhausted` for a walk the budget ended in 49 of 1000 runs with a 5 ms budget under load, and 9 to 17 per 1000 idle.

After the fix: 0 wrong reasons in 1000 runs at 5 ms, idle and loaded; the test file passed 40 of 40 idle and 40 of 40 loaded in the helper agent's copy, and 16 of 16 here. `npm run check` exits 0 on this branch, 2026-11-20.

## Reproduction details (only when needed)

Not needed.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): pukujan-lab-2/voice-agent-research#188 is the leaf; parent: none; dependencies: none.
- Primary writer / branch / source issue revision / as-of status: Claude / `fix/188-desk-timeout-reason` / #188 as filed 2026-11-20 / done, pull request open.
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

### 2026-11-20 23:46:47 UTC — Claude

<!-- continuity:checkpoint {"agent":"Claude","blocked":[],"changed":["none"],"completed":["A smart-slot call that ran out of time could be reported as every route failing; the walk now records the timeout when it happens"],"decisions":["no new decisions"],"evidence":["npm run check exits 0 on 35d9568 (2026-11-20). Before the fix the unchanged code gave the wrong reason in 49 of 1000 loaded runs at a 5 ms budget; after, 0 of 1000 loaded and idle. The test file passed 16 of 16 runs here"],"next_action":"Merge; the next deploy carries the fix","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0127","timestamp":"2026-11-20T23:46:47Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"7df769ca629af968cabfec2ade68bc7a2336effb6eb6051563509b24a00ad05c","request_id":"9f2936c67ee44850976adfe652b2d76a","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0127"} -->

Completed:
- A smart-slot call that ran out of time could be reported as every route failing; the walk now records the timeout when it happens

Evidence:
- npm run check exits 0 on 35d9568 (2026-11-20). Before the fix the unchanged code gave the wrong reason in 49 of 1000 loaded runs at a 5 ms budget; after, 0 of 1000 loaded and idle. The test file passed 16 of 16 runs here

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Merge; the next deploy carries the fix

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
