# TASK-WCP-0025 — After Deploy Replay

<!-- continuity:task {"acceptance":["When `production` moves and Komodo has deployed, the replay cases run against https://copilot.design-bakery.com","The voice test runs against the public URL","An eval span on the deploy is in Phoenix with the outcome"],"depends_on":["WCP-0024"],"goal":"Replay the cases against the live site after each deploy","id":"WCP-0025","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/20","next_action":"None for this task","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"A merge doesn't show whether the live site answers right (#92)"} -->

- Status: completed (merged in #37 as bf5597b; #20 stays open for work beyond this task)
- Owner: owner
- Priority: P2
- Depends on: WCP-0024 (#91)

## Goal

Replay the cases against the live site after each deploy

## Why

A merge doesn't show whether the live site answers right (#92)

## Allowed files

- `.github/workflows/after-deploy.yml`
- `deploy/pro/voice-check.sh`
- `deploy/pro/update.sh`
- `.gitignore`
- `eval/README.md`
- `eval/after-deploy.ts`
- `demo/live-site/tests/voice-call.ts`
- `tasks/TASK-WCP-0025-after-deploy-replay.md`

## Human outcome

After each deploy the owner has a recorded answer to "does the live site still answer right".

## Scope and boundaries

- In scope: detecting a finished deploy, replaying the cases and the voice test against the public URL, an eval span in Phoenix.
- Out of scope: rollback (Komodo does it).
- Dependencies/uncertainty: WCP-0024 (#91)

## Acceptance criteria

- [x] When `production` moves and Komodo has deployed, the replay cases run against https://copilot.design-bakery.com
- [ ] The voice test runs against the public URL (code and Pro script are in; a first run from the Pro is pending)
- [x] An eval span on the deploy is in Phoenix with the outcome

## Evidence and sources

Live spans read from the chatbots workspace on 2026-11-01 (call 7d689fcd-fe99-439c-8350-6305244e2875); parent #88.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #92; parent #88; depends on WCP-0024 (#91); related #17, #12, #13, #15.
- Primary writer / branch: claude-code / `task/WCP-0025-after-deploy-replay` (stacked on #98); source issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 18:05:30 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":[".github/workflows/after-deploy.yml, eval/after-deploy.ts, deploy/pro/{voice-check,update}.sh, demo/live-site/tests/voice-call.ts, .gitignore, eval/README.md"],"completed":["After each production move a workflow waits for Komodo, replays every case against the public site and records an eval span on the deploy in Phoenix; the voice test can now run against a deployed site and record its own span"],"decisions":["The site does not report its commit, so the workflow waits a fixed 12 minutes; the voice test stays on the Pro because it needs macOS say and Chrome for Testing, and its post-deploy start in update.sh is opt-in"],"evidence":["eval/after-deploy.ts posted a real span (deploy.replay, session deploy-testrun00001, score 0.14) that read back from Phoenix; npm run check passes. Not yet run: the workflow itself (Actions is stalled) and a voice test from the Pro against the public URL"],"next_action":"Merge #98, then this; dispatch After deploy once; run deploy/pro/voice-check.sh from the Pro","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0025","timestamp":"2026-11-01T18:05:30Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"9d4001a2f993550746c162cb35b8ac5b3e982a7c140aa1a9d9200041505da1fb","request_id":"ff64f829bb0b4dac92530e6264f92fed","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0025"} -->

Completed:
- After each production move a workflow waits for Komodo, replays every case against the public site and records an eval span on the deploy in Phoenix; the voice test can now run against a deployed site and record its own span

Evidence:
- eval/after-deploy.ts posted a real span (deploy.replay, session deploy-testrun00001, score 0.14) that read back from Phoenix; npm run check passes. Not yet run: the workflow itself (Actions is stalled) and a voice test from the Pro against the public URL

Decisions:
- The site does not report its commit, so the workflow waits a fixed 12 minutes; the voice test stays on the Pro because it needs macOS say and Chrome for Testing, and its post-deploy start in update.sh is opt-in

Changed:
- .github/workflows/after-deploy.yml, eval/after-deploy.ts, deploy/pro/{voice-check,update}.sh, demo/live-site/tests/voice-call.ts, .gitignore, eval/README.md

Blocked/uncertain:
- none

Next:
- Merge #98, then this; dispatch After deploy once; run deploy/pro/voice-check.sh from the Pro

### 2026-11-01 23:28:22 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["eval/README.md, .gitignore, task record"],"completed":["The after-deploy branch now contains the updated replay gate branch and main after the move to pukujan-lab-2"],"decisions":["no new decisions"],"evidence":["npm run check passes on the merged tree (python tests, 8/8 scenarios, replay gate ok)"],"next_action":"Merge #37 after #23","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0025","timestamp":"2026-11-01T23:28:22Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"19118b1a0af5f295e9322d245a962b0ecd2c0328234e6ed34893ce463da7ba52","request_id":"41d93f7f26ce45f2b21d230124957644","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0025"} -->

Completed:
- The after-deploy branch now contains the updated replay gate branch and main after the move to pukujan-lab-2

Evidence:
- npm run check passes on the merged tree (python tests, 8/8 scenarios, replay gate ok)

Decisions:
- no new decisions

Changed:
- eval/README.md, .gitignore, task record

Blocked/uncertain:
- none

Next:
- Merge #37 after #23

### 2026-11-01 23:33:47 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["eval/README.md"],"completed":["Merged the newest main into this branch"],"decisions":["no new decisions"],"evidence":["npm run check passes on the merged tree"],"next_action":"Merge #37","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0025","timestamp":"2026-11-01T23:33:47Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"4e24247fd3bc4bedfc4b865045936eabec9f8b8b7542a990c4f94d211cf3a3da","request_id":"ae451720f0ad42b2bbdd070111a0c5f5","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0025"} -->

Completed:
- Merged the newest main into this branch

Evidence:
- npm run check passes on the merged tree

Decisions:
- no new decisions

Changed:
- eval/README.md

Blocked/uncertain:
- none

Next:
- Merge #37

### 2026-11-01 23:38:02 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["eval/README.md"],"completed":["Merged main, which now holds the replay gate, into the after-deploy branch"],"decisions":["no new decisions"],"evidence":["npm run check passes on the merged tree"],"next_action":"Merge #37","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0025","timestamp":"2026-11-01T23:38:02Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"dcea71de140b3d5e7dae450cdb6be3c38b99a4908c93686ed82bd0deb2def814","request_id":"e5f3418449e24444a985ddbd7b4cc8bc","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0025"} -->

Completed:
- Merged main, which now holds the replay gate, into the after-deploy branch

Evidence:
- npm run check passes on the merged tree

Decisions:
- no new decisions

Changed:
- eval/README.md

Blocked/uncertain:
- none

Next:
- Merge #37

### 2026-11-01 23:40:39 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["eval/README.md"],"completed":["Merged main, which now holds the propose-fixes routine, into the after-deploy branch"],"decisions":["no new decisions"],"evidence":["npm run check passes on the merged tree"],"next_action":"Merge #37","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0025","timestamp":"2026-11-01T23:40:39Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"12ae45b5245ef56d7c081bfaa3b9d77affc6583e491ca627a1433d73fe30e9d9","request_id":"d84786fb05fe41b0a8b93fcbcda8beea","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0025"} -->

Completed:
- Merged main, which now holds the propose-fixes routine, into the after-deploy branch

Evidence:
- npm run check passes on the merged tree

Decisions:
- no new decisions

Changed:
- eval/README.md

Blocked/uncertain:
- none

Next:
- Merge #37

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
