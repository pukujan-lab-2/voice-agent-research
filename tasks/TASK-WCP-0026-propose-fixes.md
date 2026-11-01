# TASK-WCP-0026 — Propose Fixes

<!-- continuity:task {"acceptance":["One issue per failure pattern with call, turn, rule and text as evidence","No second issue while one for the pattern is open","The routine changes no code and moves no branch"],"depends_on":["WCP-0022"],"goal":"File one issue per failure pattern from flagged turns","id":"WCP-0026","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/93","next_action":"Choose the grouping key and the schedule","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Flagged turns pile up with no one reading them (#93)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: WCP-0022 (#89)

## Goal

File one issue per failure pattern from flagged turns

## Why

Flagged turns pile up with no one reading them (#93)

## Allowed files

- `eval/propose.ts`
- `eval/README.md`
- `eval/lib/patterns.ts`
- `eval/tests/propose.test.ts`
- `tasks/TASK-WCP-0026-propose-fixes.md`

## Human outcome

Flagged turns turn into issues a coding session can pick up, one per failure pattern.

## Scope and boundaries

- In scope: grouping the newest flagged turns by pattern, filing one issue per pattern with the evidence, no duplicates, a scheduled routine.
- Out of scope: any code change or deploy by the routine.
- Dependencies/uncertainty: WCP-0022 (#89)

## Acceptance criteria

- [x] One issue per failure pattern with call, turn, rule and text as evidence
- [x] No second issue while one for the pattern is open
- [x] The routine changes no code and moves no branch

## Evidence and sources

Live spans read from the chatbots workspace on 2026-11-01 (call 7d689fcd-fe99-439c-8350-6305244e2875); parent #88.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #93; parent #88; depends on WCP-0022 (#89); related #17, #12, #13, #15.
- Primary writer / branch: claude-code / `task/WCP-0026-propose-fixes`; source issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
