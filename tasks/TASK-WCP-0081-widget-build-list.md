# TASK-WCP-0081 — Widget Build List

<!-- continuity:task {"acceptance":["The live page mounts the widget (window.copilot exists) and a replay on the live site answers", "A test fails when a file the widget needs is not in build.ts's engine list"],"depends_on":[],"goal":"Put the missing engine files in the browser bundle so the copilot loads","id":"WCP-0081","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/68","next_action":"Merge, then replay on the live site","owner":"owner","priority":"P0","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The live widget never mounts: two engine files 404 (#68)"} -->

- Status: active
- Owner: owner
- Priority: P0
- Depends on: none

## Goal

Put the missing engine files in the browser bundle so the copilot loads

## Why

The live widget never mounts: two engine files 404 (#68)

## Allowed files

- `demo/live-site/build.ts`
- `demo/live-site/tests/build-list.test.ts`
- `demo/live-site/tests/live-replay.ts`
- `demo/live-site/tests/replays/call-7d689fcd.json`
- `tasks/TASK-WCP-0081-widget-build-list.md`

## Human outcome

The tax demo's copilot loads again on the live site.

## Scope and boundaries

- In scope: the browser bundle's engine file list, a test for it, and a replay script for the live site.
- Out of scope: anything about the copilot's answers.
- Dependencies/uncertainty: none. Parent: none.

## Acceptance criteria

- [ ] The live page mounts the widget (window.copilot exists) and a replay on the live site answers
- [ ] A test fails when a file the widget needs is not in build.ts's engine list

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #68; parent: none; dependencies: none.
- Primary writer claude-code / branch `task/WCP-0081-widget-build-list` / issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

### 2026-11-01 23:41:32 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["demo/live-site/build.ts, demo/live-site/tests/build-list.test.ts, demo/live-site/tests/live-replay.ts"],"completed":["The live widget did not load because three engine files were missing from the browser bundle list; added them and a test that follows the imports."],"decisions":["no new decisions"],"evidence":["npm run check passed; a local build resolves every import in dist/copilot."],"next_action":"Merge, then replay the first owner call on the live site.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0081","timestamp":"2026-11-01T23:41:32Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"2aa2ae4f649d0165e7400f14a1ee66c3c7b94edc64c66168b25759231a091d5f","request_id":"f30dcd3a2ec6462491938eb6856c185c","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0081"} -->

Completed:
- The live widget did not load because three engine files were missing from the browser bundle list; added them and a test that follows the imports.

Evidence:
- npm run check passed; a local build resolves every import in dist/copilot.

Decisions:
- no new decisions

Changed:
- demo/live-site/build.ts, demo/live-site/tests/build-list.test.ts, demo/live-site/tests/live-replay.ts

Blocked/uncertain:
- none

Next:
- Merge, then replay the first owner call on the live site.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
