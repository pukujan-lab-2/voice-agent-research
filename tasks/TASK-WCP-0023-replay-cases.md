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
- `eval/lib/expect.ts`
- `eval/lib/replay.ts`
- `eval/lib/spans.ts`
- `eval/lib/target.ts`
- `eval/cases.ts`
- `eval/tests/fixtures/call-7d689fcd.json`
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

- [x] A case stores history, input and a code-checkable expectation in an Octo table
- [x] The five seed cases from session 7d689fcd are stored and fail on the current answer path where the owner saw the bad answer
- [x] `eval/replay.ts` prints pass or fail per case
- [x] `npm run check` passes

## Evidence and sources

Live spans read from the chatbots workspace on 2026-11-01 (call 7d689fcd-fe99-439c-8350-6305244e2875); parent #88.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #90; parent #88; depends on WCP-0022 (#89); related #17, #12, #13, #15.
- Primary writer / branch: claude-code / `task/WCP-0023-replay-cases`; source issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 17:38:02 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["eval/cases.ts, eval/replay.ts, eval/lib/{cases,expect,replay,spans,target}.ts, eval/tests/, eval/README.md, task records 0022 (completed) and 0023"],"completed":["Flagged turns now become replay cases in Octo's replay_cases table, and eval/replay.ts runs them through the shipped answer path; the owner's call is seeded as seven cases, all failing"],"decisions":["Cases are open (known bad) or guarded (fixed); only a guarded failure will gate. The library path replays on recorded search/judge results so CI needs no keys"],"evidence":["Recorded run: 0 pass, 5 fail, 2 skipped; against https://copilot.design-bakery.com the two desk cases also fail (offers \"I can help you check\" and \"just say the word\"); npm run check passes"],"next_action":"Merge, then start WCP-0024: fix the dropped-answer case, promote it, gate PRs","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0023","timestamp":"2026-11-01T17:38:02Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"cbc0659b380d82bbe89f0f6b96379b61b1f6f1484b0560f36fe0874ca5e26dcd","request_id":"ea3c8e44fbee49e0958dba3540fdd274","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0023"} -->

Completed:
- Flagged turns now become replay cases in Octo's replay_cases table, and eval/replay.ts runs them through the shipped answer path; the owner's call is seeded as seven cases, all failing

Evidence:
- Recorded run: 0 pass, 5 fail, 2 skipped; against https://copilot.design-bakery.com the two desk cases also fail (offers "I can help you check" and "just say the word"); npm run check passes

Decisions:
- Cases are open (known bad) or guarded (fixed); only a guarded failure will gate. The library path replays on recorded search/judge results so CI needs no keys

Changed:
- eval/cases.ts, eval/replay.ts, eval/lib/{cases,expect,replay,spans,target}.ts, eval/tests/, eval/README.md, task records 0022 (completed) and 0023

Blocked/uncertain:
- none

Next:
- Merge, then start WCP-0024: fix the dropped-answer case, promote it, gate PRs

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
