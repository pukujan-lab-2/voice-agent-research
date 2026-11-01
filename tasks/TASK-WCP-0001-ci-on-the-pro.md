# TASK-WCP-0001 — CI on the Pro (stopgap)

<!-- continuity:task {"acceptance": ["A runner for this repository is online on the MacBook Pro and ci.yml targets it (stopgap until the VPS, #25)", "The gates check passes on that runner", "main requires a pull request and the gates check, and auto-merge is allowed", "The OIO workflows target the same runner through the OIO_RUNS_ON variable"], "depends_on": [], "goal": "Run CI on a runner we own and protect main with the gates check", "id": "WCP-0001", "next_action": "none; CI runs on the VPS org-pool runners (#25, #30)", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "done", "why": "GitHub-hosted Actions minutes are used up, so no CI job could start"} -->

- Status: done
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Run CI on a runner we own and protect `main` with the `gates` check.

## Why

GitHub-hosted Actions minutes for this private repository are used up, so every CI job failed before it started.

## Allowed files

- `.github/workflows/ci.yml`
- `docs/decisions/0008-repo-checks-and-ci.md`
- `checkpoints/CURRENT.md`
- this task file

## Human outcome

Pull requests get a real pass or fail again, and nothing lands on `main` without `gates` passing.

## Scope and boundaries

- In scope: a runner on the MacBook Pro, `ci.yml`, the `OIO_RUNS_ON` variable, branch protection on `main`.
- Out of scope: the VPS runner. Owner direction (2026-10-31) is that CI for all projects runs on the coming VPS; the Pro runner is a stopgap, and the move is #25.
- Dependencies/uncertainty: the stack-train check (not required) fails on the Pro because the shared workflow's `actions/setup-python@v5` installs under `/Users/runner`. Carried into #25.

## Acceptance criteria

- [x] Runner `macbook-pro-chatbots` (labels `self-hosted, chatbots`) is online on the Pro, and `ci.yml` targets it (#24).
- [x] `gates` passes on that runner: PR #24 run 41243305613, and `main` at `7626f40` run 41243563984.
- [x] `main` requires a pull request and the `gates` check (strict). Admins are not enforced; force pushes and deletions are blocked. Auto-merge is allowed.
- [x] `OIO_RUNS_ON` is `["self-hosted","chatbots"]`.

## Evidence and sources

- PR #24 merged as `7626f40` on 2026-10-31 at 21:25:58 UTC, via auto-merge after `gates` passed.
- Earlier runs failed with "The job was not started because an Actions budget is preventing further use."
- Local `npm run check` passed before #24: 18 engine tests and 8/8 scenarios.

## Related records

- Leaf issue: #20. Parent: none. Dependencies: none. Follow-up: #25 (move to the VPS).
- Primary writer: Claude Code session on this checkout. Branches: `ci/pro-runner` (merged), `docs/ci-stopgap-records`. As of 2026-10-31.
- PR/CI evidence: #24, runs 41243305613 and 41243563984. Push receipt: posted on #20.

## Checkpoint log

### 2026-10-31 21:31:56 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["stack-train check (not required) fails on the Pro in setup-python; carried into #25"],"changed":[".github/workflows/ci.yml, docs/decisions/0008-repo-checks-and-ci.md, checkpoints/CURRENT.md, tasks/TASK-WCP-0001-ci-on-the-pro.md"],"completed":["CI moved to the Pro stopgap runner (#24, 7626f40); main protected with the gates check; owner direction to move CI to the VPS recorded on #20 and filed as #25"],"decisions":["Pro runner is a stopgap; CI for all projects targets the coming VPS (owner, 2026-10-31)"],"evidence":["gates passed on macbook-pro-chatbots: runs 41243305613 (PR #24) and 41243563984 (main 7626f40); npm run check passed locally"],"next_action":"Merge the records PR, post the receipt on #20 with the merged SHA, close #20","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0001","timestamp":"2026-10-31T21:31:56Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"085c4fdae1b110e41f022a6b86dda11c5cd4f2aca456ce1897e6378d6ef9649b","request_id":"4bad9120c0944cd28830e16343b1981a","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0001"} -->

Completed:
- CI moved to the Pro stopgap runner (#24, 7626f40); main protected with the gates check; owner direction to move CI to the VPS recorded on #20 and filed as #25

Evidence:
- gates passed on macbook-pro-chatbots: runs 41243305613 (PR #24) and 41243563984 (main 7626f40); npm run check passed locally

Decisions:
- Pro runner is a stopgap; CI for all projects targets the coming VPS (owner, 2026-10-31)

Changed:
- .github/workflows/ci.yml, docs/decisions/0008-repo-checks-and-ci.md, checkpoints/CURRENT.md, tasks/TASK-WCP-0001-ci-on-the-pro.md

Blocked/uncertain:
- stack-train check (not required) fails on the Pro in setup-python; carried into #25

Next:
- Merge the records PR, post the receipt on #20 with the merged SHA, close #20

### 2026-11-01 01:48:36 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["docs/decisions/0008-repo-checks-and-ci.md, checkpoints/CURRENT.md, tasks/TASK-WCP-0001-ci-on-the-pro.md"],"completed":["Confirmed #25 is met: ci.yml and OIO_RUNS_ON target [self-hosted, org-pool] on the VPS (#30), and the Pro runner folder and service are gone; records updated"],"decisions":["No branch protection on Pukujan-lab free plan; PRs merged by hand after gates (owner, #29)"],"evidence":["gates and stack-train passed on org-pool in run 41262473328 (#35); repo runners count 0; ~/ci/runners on the Pro is empty; npm run check passed"],"next_action":"none; close #25 after this merges","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0001","timestamp":"2026-11-01T01:48:36Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"a7b1d920576a4119578ad22f189d92809ad3897b63a1a04e0060675a2c749207","request_id":"f0d3bd24132044678662ecbd54fd90b6","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0001"} -->

Completed:
- Confirmed #25 is met: ci.yml and OIO_RUNS_ON target [self-hosted, org-pool] on the VPS (#30), and the Pro runner folder and service are gone; records updated

Evidence:
- gates and stack-train passed on org-pool in run 41262473328 (#35); repo runners count 0; ~/ci/runners on the Pro is empty; npm run check passed

Decisions:
- No branch protection on Pukujan-lab free plan; PRs merged by hand after gates (owner, #29)

Changed:
- docs/decisions/0008-repo-checks-and-ci.md, checkpoints/CURRENT.md, tasks/TASK-WCP-0001-ci-on-the-pro.md

Blocked/uncertain:
- none

Next:
- none; close #25 after this merges

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
