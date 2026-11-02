# TASK-WCP-0082 — Replay Post Step

<!-- continuity:task {"acceptance":["Both replay workflows write replay.json in the workspace and run their post step","A dispatched run of each shows the post step as success"],"depends_on":[],"goal":"The replay workflows post their result","id":"WCP-0082","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/72","next_action":"Merge, then dispatch both workflows again","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Both first runs skipped the post step because hashFiles cannot see RUNNER_TEMP (#72)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

The replay workflows post their result

## Why

Both first runs skipped the post step because hashFiles cannot see RUNNER_TEMP (#72)

## Allowed files

- `.github/workflows/replay-live.yml`
- `.github/workflows/after-deploy.yml`
- `tasks/TASK-WCP-0082-replay-post-step.md`

## Human outcome

The nightly and after-deploy replays leave their results on the standing issue and in Phoenix.

## Scope and boundaries

- In scope: the result file path and the step condition in both workflows.
- Out of scope: the replay itself.
- Dependencies/uncertainty: none

## Acceptance criteria

- [ ] Both replay workflows write replay.json in the workspace and run their post step
- [ ] A dispatched run of each shows the post step as success

## Evidence and sources

Runs 41364651415 (Live replay) and 41364653860 (After deploy): replay step success, post step skipped.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #72; parent #18; depends on none; related #19, #20, #22.
- Primary writer / branch: claude-code / `task/replay-post-fix`; source issue open as of 2026-11-02.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

### 2026-11-02 00:00:06 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":[".github/workflows/{replay-live,after-deploy}.yml, task record"],"completed":["The two replay workflows now write their result file in the workspace, where the step condition can see it"],"decisions":["no new decisions"],"evidence":["First runs of both passed their replay step and skipped their post step (runs 41364651415 and 41364653860); not yet re-run"],"next_action":"Merge, then dispatch both workflows again","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0082","timestamp":"2026-11-02T00:00:06Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"4f51820aeb8d289c403762e85a3ad4f0d24a1e8f036aa31faf1afda21e804154","request_id":"784e3210c565484fbbed29b137a5f93e","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0082"} -->

Completed:
- The two replay workflows now write their result file in the workspace, where the step condition can see it

Evidence:
- First runs of both passed their replay step and skipped their post step (runs 41364651415 and 41364653860); not yet re-run

Decisions:
- no new decisions

Changed:
- .github/workflows/{replay-live,after-deploy}.yml, task record

Blocked/uncertain:
- none

Next:
- Merge, then dispatch both workflows again

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
