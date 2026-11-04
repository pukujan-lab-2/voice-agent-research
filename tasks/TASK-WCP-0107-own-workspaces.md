# TASK-WCP-0107 — Own Workspaces

<!-- continuity:task {"acceptance":["Adding an outside business to the registry creates its Octo workspace and stores the workspace id in that business's registry entry; a retried add reuses the same workspace","A put can never point a business at a workspace the factory did not create for it, or move a business off its own workspace","That business's config, resume sessions and traces are read and written in its own workspace","A plain-code test runs a test business's chat end to end in its own workspace, and the shared workspace gains no rows for it","Demo businesses keep working on the shared workspace with their prefix"],"depends_on":[],"goal":"Give each outside business its own Octo workspace, created from its config","id":"WCP-0107","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/127","next_action":"None for this task","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"Every business lives in one shared Octo workspace told apart by a prefix; one wrong query shows a business another's callers. Outside businesses can't go live until each has its own (#127, decision 0021 settlement 1)"} -->

- Status: completed (merged in #135 as c4313e6)
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Give each outside business its own Octo workspace, created from its config

## Why

Every business lives in one shared Octo workspace told apart by a prefix; one wrong query shows a business another's callers. Outside businesses can't go live until each has its own (#127, decision 0021 settlement 1)

## Allowed files

- copilot-engine/src/site-config.ts
- copilot-engine/src/octo-workspaces.ts
- copilot-engine/tests/site-config.test.ts
- demo/live-site/api.ts
- demo/live-site/server.ts
- demo/live-site/tracing.ts
- demo/live-site/tools/site-config.ts
- demo/live-site/tests/own-workspace.test.ts
- tasks/TASK-WCP-0107-own-workspaces.md

## Human outcome

An outside business's callers, sessions and traces sit in a workspace of its own, so no query for another business can reach them; the factory's demo businesses work as before.

## Scope and boundaries

- In scope: creating the workspace from the registry's put, storing its id in the registry entry, routing that business's config, resume sessions and traces to it, tests.
- Out of scope: engine-side isolation (octo-database#10), encryption (phase 1, #128), the onboarding screen, the voice agent's own traces (speech/telemetry.py; a follow-up).
- Dependencies/uncertainty: needs the account-wide Octo key (saved 2026-11-04). Octo allows one new workspace per day per account and deleting one needs a human session with MFA, so tests use a fake Octo and create no live workspace.

## Acceptance criteria

- [ ] Adding an outside business to the registry creates its Octo workspace and stores the workspace id in that business's registry entry; a retried add reuses the same workspace
- [ ] A put can never point a business at a workspace the factory did not create for it, or move a business off its own workspace
- [ ] That business's config, resume sessions and traces are read and written in its own workspace
- [ ] A plain-code test runs a test business's chat end to end in its own workspace, and the shared workspace gains no rows for it
- [ ] Demo businesses keep working on the shared workspace with their prefix

## Evidence and sources

Starting revision f5d0c94 (main after #134). Octo's create route: `POST /api/workspaces` with `{ name, slug, description }` answers 201 with `workspace.id` and a one-time workspace key, 409 SLUG_TAKEN, 429 WORKSPACE_DAILY_LIMIT (pukujan-lab-2/octo-database `src/routes/workspaces.ts`).

## Reproduction details (only when needed)

Not needed.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #127; parent #121; depends on #28 (done) and pukujan-lab-2/octo-database#10 (engine-side isolation, open, not blocking this code)
- Primary writer / branch / source issue revision / as-of status: Claude Code side session of local_a2ffa57e / task/WCP-0107-own-workspaces / #127 as filed 2026-11-04 / active
- Related PR/CI evidence and push receipt (request ID / SHA): pending

## Checkpoint log

No checkpoints yet.

### 2026-11-04 22:02:56 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/octo-workspaces.ts, copilot-engine/src/site-config.ts, demo/live-site/api.ts, demo/live-site/tracing.ts, demo/live-site/server.ts, demo/live-site/tools/site-config.ts, tests"],"completed":["An outside business added to the registry with workspace: {} now gets its own Octo workspace; its config, resume sessions and traces are read and written there, and demo businesses stay on the shared workspace"],"decisions":["The factory reaches business workspaces with the account-wide key; the workspace's own first key is dropped until keys live in OpenBao (#128). No live workspace was created: Octo allows one a day and deletion needs the owner's MFA session"],"evidence":["Lint, typecheck, knip and JS tests pass locally (163 + 51 + 91 tests, 0 failures); new own-workspace.test.ts (4) and site-config.test.ts (8) pass on PGlite with Octo faked at fetch"],"next_action":"open the pull request with Closes #127, confirm CI is green, arm auto-merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0107","timestamp":"2026-11-04T22:02:56Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"4e0fb14c57c7abe69d398c9b8b6ab1fb1b7eb8ad1d8d96a7cd69b73b7bfac521","request_id":"870dfebdda4c4d75afbdd15212868d97","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0107"} -->

Completed:
- An outside business added to the registry with workspace: {} now gets its own Octo workspace; its config, resume sessions and traces are read and written there, and demo businesses stay on the shared workspace

Evidence:
- Lint, typecheck, knip and JS tests pass locally (163 + 51 + 91 tests, 0 failures); new own-workspace.test.ts (4) and site-config.test.ts (8) pass on PGlite with Octo faked at fetch

Decisions:
- The factory reaches business workspaces with the account-wide key; the workspace's own first key is dropped until keys live in OpenBao (#128). No live workspace was created: Octo allows one a day and deletion needs the owner's MFA session

Changed:
- copilot-engine/src/octo-workspaces.ts, copilot-engine/src/site-config.ts, demo/live-site/api.ts, demo/live-site/tracing.ts, demo/live-site/server.ts, demo/live-site/tools/site-config.ts, tests

Blocked/uncertain:
- none

Next:
- open the pull request with Closes #127, confirm CI is green, arm auto-merge

### 2026-11-04 23:50:48 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["tasks/TASK-WCP-0107..0111"],"completed":["Records for WCP-0107 to WCP-0111 now say completed with their merging PRs (#135 to #139)"],"decisions":["no new decisions"],"evidence":["Each PR shows merged on GitHub with the commit named in its record"],"next_action":"Merge this records PR, then run continuity worktree remove for WCP-0107 to WCP-0111","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0107","timestamp":"2026-11-04T23:50:48Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"5701177158dabc497fc0e1178aa6a0d1dd9eaed46094719820abf588d1eb149b","request_id":"f2366181448c4a8f9300de35514b1649","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0107"} -->

Completed:
- Records for WCP-0107 to WCP-0111 now say completed with their merging PRs (#135 to #139)

Evidence:
- Each PR shows merged on GitHub with the commit named in its record

Decisions:
- no new decisions

Changed:
- tasks/TASK-WCP-0107..0111

Blocked/uncertain:
- none

Next:
- Merge this records PR, then run continuity worktree remove for WCP-0107 to WCP-0111

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
