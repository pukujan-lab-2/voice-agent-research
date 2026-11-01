# TASK-WCP-0009 — Hosted runners

<!-- continuity:task {"acceptance":["gates and stack-train run on ubuntu-latest","OIO_RUNS_ON is removed","Decision 0010 replaces 0008","Queued pull requests get a gates result"],"depends_on":[],"goal":"CI runs on GitHub-hosted runners now the repo is public","id":"WCP-0009","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/50","next_action":"Open the pull request for #50, remove OIO_RUNS_ON, and rerun CI on #46, #47 and #49","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The org runner group refuses public repositories, so CI never starts"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: #42

## Goal

CI runs on GitHub-hosted runners now the repo is public.

## Why

The org runner group refuses public repositories, so CI never starts (#50).

## Allowed files

- `.github/workflows/ci.yml`
- `docs/decisions/0008-repo-checks-and-ci.md`, `docs/decisions/0010-ci-on-hosted-runners.md`, `docs/decisions/README.md`
- `copilot-engine/ledger.jsonl` (rows `npm run check` appends)
- this task file; the `OIO_RUNS_ON` repository variable

## Human outcome

Pull requests get a `gates` result and merge again, without outside code running on the VPS.

## Scope and boundaries

- In scope: the runner choice for CI and the OIO workflows.
- Out of scope: the org runner group settings.
- Dependencies/uncertainty: hosted runner setup may differ from the VPS.

## Acceptance criteria

- [x] `gates` and stack-train ask for `ubuntu-latest`.
- [ ] `OIO_RUNS_ON` is removed.
- [x] Decision 0010 replaces 0008.
- [ ] Queued pull requests get a `gates` result.

## Evidence and sources

- Runner group API: Default group, `allows_public_repositories: false`; VPS runners online and idle while runs stayed queued.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #50; parent none; depends on #42. Related: #29.
- Primary writer / branch / source issue revision / as-of status: claude-code / `ci/50-hosted-runners` / issue #50 as of 2026-11-01 / open.
- Related PR/CI evidence and push receipt (request ID / SHA): the receipt follows the checkpoint push.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 02:48:31 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":[".github/workflows/ci.yml","docs/decisions/0010-ci-on-hosted-runners.md","docs/decisions/0008-repo-checks-and-ci.md","docs/decisions/README.md"],"completed":["Moved gates and the stack-train check to ubuntu-latest and wrote decision 0010, replacing 0008"],"decisions":["no new decisions"],"evidence":["npm run check passes: lint, typecheck, knip; npm test 33/33; scenarios 8/8"],"next_action":"Open the pull request for #50, remove OIO_RUNS_ON, and rerun CI on #46, #47 and #49","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0009","timestamp":"2026-11-01T02:48:31Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"f7ffc23e5996101842592d1e153c45b1382fc2b1d18379c964bc51e1584949d9","request_id":"b103e9b4ffd44c7bacd7182b010e4634","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0009"} -->

Completed:
- Moved gates and the stack-train check to ubuntu-latest and wrote decision 0010, replacing 0008

Evidence:
- npm run check passes: lint, typecheck, knip; npm test 33/33; scenarios 8/8

Decisions:
- no new decisions

Changed:
- .github/workflows/ci.yml
- docs/decisions/0010-ci-on-hosted-runners.md
- docs/decisions/0008-repo-checks-and-ci.md
- docs/decisions/README.md

Blocked/uncertain:
- none

Next:
- Open the pull request for #50, remove OIO_RUNS_ON, and rerun CI on #46, #47 and #49
