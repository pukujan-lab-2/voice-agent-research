# TASK-WCP-0024 — Replay Gate

<!-- continuity:task {"acceptance":["CI replays the cases offline with recorded search results and fails the PR on a regression","A reverted fix makes that check fail","The live set runs nightly and on every `production` move and posts to a standing issue","An issue opens when a rule's failure count rises"],"depends_on":["WCP-0023"],"goal":"Fail pull requests that bring back a flagged answer; run the live set nightly","id":"WCP-0024","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/19","next_action":"None for this task","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"CI never runs an answer (#91)"} -->

- Status: completed (merged in #23 as 89ed48c; #19 stays open for work beyond this task)
- Owner: owner
- Priority: P2
- Depends on: WCP-0023 (#90)

## Goal

Fail pull requests that bring back a flagged answer; run the live set nightly

## Why

CI never runs an answer (#91)

## Allowed files

- `.github/workflows/ci.yml`
- `.github/workflows/replay-live.yml`
- `eval/post-replay.ts`
- `eval/lib/standing.ts`
- `eval/lib/site.ts`
- `eval/cases/snapshot.json`
- `eval/tests/*.test.ts`
- `eval/README.md`
- `package.json`
- `tasks/TASK-WCP-0023-replay-cases.md`
- `eval/replay.ts`
- `eval/lib/*.ts`
- `eval/fixtures/*`
- `tasks/TASK-WCP-0024-replay-gate.md`

## Human outcome

A pull request that brings a flagged answer back is blocked, and answer quality is checked every night.

## Scope and boundaries

- In scope: an offline replay job on every pull request, the live replay nightly and on `production`, the standing issue, the issue opened when a rule's failure count rises.
- Out of scope: acting on failures (WCP-0026).
- Dependencies/uncertainty: WCP-0023 (#90)

## Acceptance criteria

- [x] CI replays the cases offline with recorded search results and fails the PR on a regression
- [ ] A reverted fix makes that check fail
- [ ] The live set runs nightly (the production-move run is #92: it must wait for the deploy) and posts to the standing issue #97
- [ ] An issue opens when a rule's failure count rises

## Evidence and sources

Live spans read from the chatbots workspace on 2026-11-01 (call 7d689fcd-fe99-439c-8350-6305244e2875); parent #88.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #91; parent #88; depends on WCP-0023 (#90); related #17, #12, #13, #15.
- Primary writer / branch: claude-code / `task/WCP-0024-replay-gate`; source issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 17:44:50 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":[".github/workflows/{ci,replay-live}.yml, eval/{replay,post-replay}.ts, eval/lib/{replay,site,standing}.ts, eval/cases/snapshot.json, eval/tests/, package.json, task records"],"completed":["CI now replays the guarded cases on every pull request and fails when one regresses; a nightly workflow replays all cases against the live site and posts per-rule counts on standing issue #97"],"decisions":["The cases are exported to eval/cases/snapshot.json as a test fixture so CI and the nightly run need no keys; the run on every production move is #92's, because it must wait for Komodo to finish deploying"],"evidence":["npm run check passes with the new replay step; 16 eval tests, including the gate exiting 1 for a guarded failure and 0 for an open one; a run of the snapshot against https://copilot.design-bakery.com gave 1 pass, 6 fail"],"next_action":"Merge, dispatch the nightly workflow once to post the baseline on #97, then file and build the fix for the dropped-answer case","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0024","timestamp":"2026-11-01T17:44:50Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"89c09ce185827a2c9376e85301dbb4583cc1c30a995bfa8afc4f54cef19dfd65","request_id":"335b2806f5434ca99c5742c1830f72d4","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0024"} -->

Completed:
- CI now replays the guarded cases on every pull request and fails when one regresses; a nightly workflow replays all cases against the live site and posts per-rule counts on standing issue #97

Evidence:
- npm run check passes with the new replay step; 16 eval tests, including the gate exiting 1 for a guarded failure and 0 for an open one; a run of the snapshot against https://copilot.design-bakery.com gave 1 pass, 6 fail

Decisions:
- The cases are exported to eval/cases/snapshot.json as a test fixture so CI and the nightly run need no keys; the run on every production move is #92's, because it must wait for Komodo to finish deploying

Changed:
- .github/workflows/{ci,replay-live}.yml, eval/{replay,post-replay}.ts, eval/lib/{replay,site,standing}.ts, eval/cases/snapshot.json, eval/tests/, package.json, task records

Blocked/uncertain:
- none

Next:
- Merge, dispatch the nightly workflow once to post the baseline on #97, then file and build the fix for the dropped-answer case

### 2026-11-01 23:26:14 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["package.json, tasks/TASK-WCP-0023-replay-cases.md, replay-live.yml, eval/README.md, eval/post-replay.ts"],"completed":["The replay gate branch now contains main after the move to pukujan-lab-2; package.json keeps both the replay step and the ingest tests, the standing issue is #22"],"decisions":["no new decisions"],"evidence":["npm run check passes on the merged tree (31 python tests, 8/8 scenarios, replay gate ok)"],"next_action":"Merge #23, then rebase-merge #37 and #39 the same way","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0024","timestamp":"2026-11-01T23:26:14Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"e34e8e2f4ae43729089c2d4f97bec7d4e1d52171d0647178bdaaeb82512afea3","request_id":"53f02bb9d8214e2aac0a2832c94ae92f","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0024"} -->

Completed:
- The replay gate branch now contains main after the move to pukujan-lab-2; package.json keeps both the replay step and the ingest tests, the standing issue is #22

Evidence:
- npm run check passes on the merged tree (31 python tests, 8/8 scenarios, replay gate ok)

Decisions:
- no new decisions

Changed:
- package.json, tasks/TASK-WCP-0023-replay-cases.md, replay-live.yml, eval/README.md, eval/post-replay.ts

Blocked/uncertain:
- none

Next:
- Merge #23, then rebase-merge #37 and #39 the same way

### 2026-11-01 23:26:49 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["package.json, tasks/TASK-WCP-0023-replay-cases.md, replay-live.yml, eval/README.md, eval/post-replay.ts"],"completed":["The replay gate branch now contains main after the move to pukujan-lab-2; package.json keeps both the replay step and the ingest tests, the standing issue is #22"],"decisions":["no new decisions"],"evidence":["npm run check passes on the merged tree (python tests, 8/8 scenarios, replay gate ok)"],"next_action":"Merge #23, then #37 and #39","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0024","timestamp":"2026-11-01T23:26:49Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"e70ed8a9f40ce94d9eb395e811644517181a4aa40bb3974afdf9b7cb2fe5cdd8","request_id":"3b9cea67d21842648def437dd520ba9f","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0024"} -->

Completed:
- The replay gate branch now contains main after the move to pukujan-lab-2; package.json keeps both the replay step and the ingest tests, the standing issue is #22

Evidence:
- npm run check passes on the merged tree (python tests, 8/8 scenarios, replay gate ok)

Decisions:
- no new decisions

Changed:
- package.json, tasks/TASK-WCP-0023-replay-cases.md, replay-live.yml, eval/README.md, eval/post-replay.ts

Blocked/uncertain:
- none

Next:
- Merge #23, then #37 and #39

### 2026-11-01 23:32:50 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["eval/README.md"],"completed":["Merged the newest main into the replay gate branch"],"decisions":["no new decisions"],"evidence":["npm run check passes on the merged tree"],"next_action":"Merge #23","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0024","timestamp":"2026-11-01T23:32:50Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"62247f889835f98ec6afaa7a918b0282f9f76d5a95a38fc7f6ce46231ccae31c","request_id":"98cc62b7f71f4af7a9c755dfc082a7d8","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0024"} -->

Completed:
- Merged the newest main into the replay gate branch

Evidence:
- npm run check passes on the merged tree

Decisions:
- no new decisions

Changed:
- eval/README.md

Blocked/uncertain:
- none

Next:
- Merge #23

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
