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

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
