# TASK-WCP-0075 — Fragments And Refusals

<!-- continuity:task {"acceptance":["Fragments of one question are joined, fillers do not end a turn, and a fragment is never searched alone", "Two refusals in a row never read the same, and the second names the closest passage, asks one question or offers a preparer", "A tied pick is quoted and called the closest the guides have", "Date questions return the due-date passage in the top 4 on the real search and judge", "The waiting line is silent for 1.2 seconds, then varied, and every line is pre-synthesized", "Held-out judge numbers are reported; tests replay call 75aeb0b4; npm run check passes"],"depends_on":[],"goal":"Stop a thinking pause from splitting a question, repeated refusals and refused ties in the tax copilot","id":"WCP-0075","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/66","next_action":"Merge, then replay the second call on the live site","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The owner's second call: fragments searched alone, the same refusal three times, a tied passage refused (#66)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Stop a thinking pause from splitting a question, repeated refusals and refused ties in the tax copilot

## Why

The owner's second call: fragments searched alone, the same refusal three times, a tied passage refused (#66)

## Allowed files

- `copilot-engine/src/dialogue.ts`
- `copilot-engine/src/guide.ts`
- `copilot-engine/src/desk.ts`
- `copilot-engine/tests/judge-rule.test.ts`
- `demo/live-site/widget/sdk.ts`
- `demo/live-site/speech/agent.py`
- `demo/live-site/speech/server.py`
- `demo/live-site/tests/judge-trace.test.ts`
- `demo/live-site/tests/replays/call-75aeb0b4.json`
- `eval/tests/conversation-pauses.test.ts`
- `eval/tests/fixtures/call-75aeb0b4.json`
- `eval/deadline-cases.ts`
- `eval/out/irs/judge-rule.json`
- `eval/README.md`
- `tasks/TASK-WCP-0075-fragments-and-refusals.md`

## Human outcome

A visitor who pauses to think is understood as one question, a question the guides can answer is answered at a tie, and the copilot does not say the same refusal twice.

## Scope and boundaries

- In scope: the six items of #66 (pause fragments, repeated refusals, tied pick, date retrieval, rewrite context, waiting line).
- Out of scope: model changes or comparisons; the voice stacks themselves.
- Dependencies/uncertainty: #46 and #69 merged. Parent: none.

## Acceptance criteria

- [ ] Fragments of one question are joined, fillers do not end a turn, and a fragment is never searched alone
- [ ] Two refusals in a row never read the same, and the second names the closest passage, asks one question or offers a preparer
- [ ] A tied pick is quoted and called the closest the guides have
- [ ] Date questions return the due-date passage in the top 4 on the real search and judge
- [ ] The waiting line is silent for 1.2 seconds, then varied, and every line is pre-synthesized
- [ ] Held-out judge numbers are reported; tests replay call 75aeb0b4; npm run check passes

## Evidence and sources

Phoenix traces of the owner's call, 2026-11-01 23:27-23:29 UTC, session 75aeb0b4 (fixture `eval/tests/fixtures/call-75aeb0b4.json`). Live probes of /api/search and /api/judge from the parent session; held-out numbers in `eval/out/irs/judge-rule.json`.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #66 (https://github.com/pukujan-lab-2/voice-agent-research/issues/66); parent: none; dependencies: #24 (merged in #46), #68 (merged in #69).
- Primary writer claude-code / branch `task/WCP-0075-fragments-and-refusals` / issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
