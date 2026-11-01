# TASK-WCP-0003 — Desk v2

<!-- continuity:task {"acceptance": ["The v2 desk passes npm run check (lint, strict typecheck, tests)", "The live site uses the v2 desk with call resume and opt-in returning-customer memory", "Desk-sim results on the default model are recorded"], "depends_on": [], "goal": "Merge the v2 desk (memory, resume) into the live site", "id": "WCP-0003", "issue_url": "https://github.com/Pukujan-lab/voice-agent-research/issues/16", "next_action": "Review PR #37, then wire the v2 desk into the live site", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The v2 desk handles read-backs, resume and returning customers better than the live site's form flow"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Merge the v2 desk (memory, resume) into the live site

## Why

The v2 desk handles read-backs, resume and returning customers better than the live site's form flow

## Allowed files

- `copilot-engine/src/desk*.ts`, `copilot-engine/tests/desk*`
- this task file

## Human outcome

Callers get a receptionist that reads values back, resumes dropped calls and remembers returning customers when they opt in.

## Scope and boundaries

- In scope: the desk engine, its simulator and tests, and wiring it into the live site.
- Out of scope: voice (#11).
- Dependencies/uncertainty: the branch was written on 2026-10-30 in an agent worktree, never pushed, and rebased onto main on 2026-10-31; one commit is marked WIP.

## Acceptance criteria

- [x] `npm run check` passes, and `npm test` now runs the 15 desk tests too (33 tests in all).
- [ ] The live site uses the v2 desk.
- [ ] Desk-sim results on the default model are recorded.

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf issue: #16. Parent: none. Dependencies: none.
- Branch: `feat/16-desk-v2`, pushed for review and not merged (owner direction, 2026-10-31). As of 2026-10-31.
- PR and receipt: posted on #16.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 01:51:37 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["Strict typecheck fails on 3 desk errors, so gates will fail until they are fixed"],"changed":["copilot-engine/src/desk*.ts, copilot-engine/tests/desk*, tasks/TASK-WCP-0003-desk-v2.md"],"completed":["Pushed the v2 desk (10 commits written 2026-10-30, never pushed) plus its last uncommitted sim changes, rebased onto main; fixed a duplicate judge key in the desk-sim summary"],"decisions":["Pushed for review only, not merged (owner, 2026-10-31)"],"evidence":["npm run check on the rebased branch: lint passes, 3 strict-typecheck errors remain in copilot-engine/src/desk.ts (755, 766) and tests/desk.test.ts (14)"],"next_action":"Fix the 3 typecheck errors in desk.ts and desk.test.ts","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0003","timestamp":"2026-11-01T01:51:37Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"7009d729da2f68f4ee37dbbac0e604ab0933411a4bcdccef997c4df00a69a21b","request_id":"65c829664a2c43b3ad69b52932b34a1b","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0003"} -->

Completed:
- Pushed the v2 desk (10 commits written 2026-10-30, never pushed) plus its last uncommitted sim changes, rebased onto main; fixed a duplicate judge key in the desk-sim summary

Evidence:
- npm run check on the rebased branch: lint passes, 3 strict-typecheck errors remain in copilot-engine/src/desk.ts (755, 766) and tests/desk.test.ts (14)

Decisions:
- Pushed for review only, not merged (owner, 2026-10-31)

Changed:
- copilot-engine/src/desk*.ts, copilot-engine/tests/desk*, tasks/TASK-WCP-0003-desk-v2.md

Blocked/uncertain:
- Strict typecheck fails on 3 desk errors, so gates will fail until they are fixed

Next:
- Fix the 3 typecheck errors in desk.ts and desk.test.ts

### 2026-11-01 01:53:19 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/desk.ts, copilot-engine/tests/desk.test.ts, copilot-engine/package.json, tasks/TASK-WCP-0003-desk-v2.md"],"completed":["Fixed the 3 strict-typecheck errors in the desk without changing behaviour, and added the desk tests to npm test"],"decisions":["no new decisions"],"evidence":["npm run check passes; npm test 33/33 (18 engine + 15 desk); scenarios 8/8"],"next_action":"Review PR #37, then wire the v2 desk into the live site","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0003","timestamp":"2026-11-01T01:53:19Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"a5299c9dbbd6575f5be07d3ff165860a9fa8ab49bc905e7e1ac45f4d545718dc","request_id":"700c492e71c64c699235f486f33c86c4","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0003"} -->

Completed:
- Fixed the 3 strict-typecheck errors in the desk without changing behaviour, and added the desk tests to npm test

Evidence:
- npm run check passes; npm test 33/33 (18 engine + 15 desk); scenarios 8/8

Decisions:
- no new decisions

Changed:
- copilot-engine/src/desk.ts, copilot-engine/tests/desk.test.ts, copilot-engine/package.json, tasks/TASK-WCP-0003-desk-v2.md

Blocked/uncertain:
- none

Next:
- Review PR #37, then wire the v2 desk into the live site

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
