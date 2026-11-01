# TASK-WCP-0024 — Replay Gate

<!-- continuity:task {"acceptance":["CI replays the cases offline with recorded search results and fails the PR on a regression","A reverted fix makes that check fail","The live set runs nightly and on every `production` move and posts to a standing issue","An issue opens when a rule's failure count rises"],"depends_on":["WCP-0023"],"goal":"Fail pull requests that bring back a flagged answer; run the live set nightly","id":"WCP-0024","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/19","next_action":"Record search results for the seed cases","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"CI never runs an answer (#91)"} -->

- Status: active
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

- [ ] CI replays the cases offline with recorded search results and fails the PR on a regression
- [ ] A reverted fix makes that check fail
- [ ] The live set runs nightly and on every `production` move and posts to a standing issue
- [ ] An issue opens when a rule's failure count rises

## Evidence and sources

Live spans read from the chatbots workspace on 2026-11-01 (call 7d689fcd-fe99-439c-8350-6305244e2875); parent #88.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #91; parent #88; depends on WCP-0023 (#90); related #17, #12, #13, #15.
- Primary writer / branch: claude-code / `task/WCP-0024-*` (not started); source issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
