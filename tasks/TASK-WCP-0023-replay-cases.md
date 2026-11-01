# TASK-WCP-0023 — Replay Cases

<!-- continuity:task {"acceptance":["A case stores history, input and a code-checkable expectation in an Octo table","The five seed cases from session 7d689fcd are stored and fail on the current answer path where the owner saw the bad answer","`eval/replay.ts` prints pass or fail per case","`npm run check` passes"],"depends_on":["WCP-0022"],"goal":"Turn flagged turns into replay cases stored in Octo","id":"WCP-0023","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/90","next_action":"Define the case format and expectations","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A flagged turn can't be re-run, so a fix can't be proven (#90)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: WCP-0022 (#89)

## Goal

Turn flagged turns into replay cases stored in Octo

## Why

A flagged turn can't be re-run, so a fix can't be proven (#90)

## Allowed files

- `eval/replay.ts`
- `eval/lib/cases.ts`
- `eval/tests/cases.test.ts`
- `eval/README.md`
- `tasks/TASK-WCP-0023-replay-cases.md`

## Human outcome

A bad real turn becomes a test that fails until the answer is fixed.

## Scope and boundaries

- In scope: the case format, its Octo table, the seed from the 2026-11-01 call, and a runner against the shipped answer path.
- Out of scope: CI wiring (WCP-0024).
- Dependencies/uncertainty: WCP-0022 (#89)

## Acceptance criteria

- [ ] A case stores history, input and a code-checkable expectation in an Octo table
- [ ] The five seed cases from session 7d689fcd are stored and fail on the current answer path where the owner saw the bad answer
- [ ] `eval/replay.ts` prints pass or fail per case
- [ ] `npm run check` passes

## Evidence and sources

Live spans read from the chatbots workspace on 2026-11-01 (call 7d689fcd-fe99-439c-8350-6305244e2875); parent #88.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #90; parent #88; depends on WCP-0022 (#89); related #17, #12, #13, #15.
- Primary writer / branch: claude-code / `task/WCP-0023-*` (not started); source issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
