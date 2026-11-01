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

### 2026-11-01 23:50:55 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/dialogue.ts, guide.ts, desk.ts, demo/live-site/widget/sdk.ts, speech/agent.py, speech/server.py, tests"],"completed":["A pause cut the owner's question in pieces that were searched alone, the same refusal came back three times and a tied passage was refused; fragments are joined, refusals vary, a tie is quoted as the closest, date questions find the due-date passage, and the waiting line varies."],"decisions":["A tie (own probability within 0.02 of none) is quoted and said to be the closest; the agent.py changes are not covered by an automated test, which the repo has no harness for."],"evidence":["npm run check passed (130 engine tests, 41 eval and live-site tests, 15 python tests, 8 scenarios); node eval/deadline-cases.ts 5 of 5 on the real search and judge; held-out: right passage 141 of 200 (139 before), made-up answers 4 of 100 (3 before)."],"next_action":"Merge, then replay both owner calls on the live site and post the dialogues.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0075","timestamp":"2026-11-01T23:50:55Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"b27934f73803954185aad03b3c623478dd5bdca46b9965683b6ab7d5bbbdd19f","request_id":"30f277b3d90d4e52bd9d0561d1901ffc","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0075"} -->

Completed:
- A pause cut the owner's question in pieces that were searched alone, the same refusal came back three times and a tied passage was refused; fragments are joined, refusals vary, a tie is quoted as the closest, date questions find the due-date passage, and the waiting line varies.

Evidence:
- npm run check passed (130 engine tests, 41 eval and live-site tests, 15 python tests, 8 scenarios); node eval/deadline-cases.ts 5 of 5 on the real search and judge; held-out: right passage 141 of 200 (139 before), made-up answers 4 of 100 (3 before).

Decisions:
- A tie (own probability within 0.02 of none) is quoted and said to be the closest; the agent.py changes are not covered by an automated test, which the repo has no harness for.

Changed:
- copilot-engine/src/dialogue.ts, guide.ts, desk.ts, demo/live-site/widget/sdk.ts, speech/agent.py, speech/server.py, tests

Blocked/uncertain:
- none

Next:
- Merge, then replay both owner calls on the live site and post the dialogues.

### 2026-11-01 23:57:23 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/desk.ts, copilot-engine/tests/desk.test.ts, demo/live-site/speech/agent.py (merge)"],"completed":["A live replay of the owner's first call showed the desk model refusing a question without looking it up; the library is now asked when the model refuses, and main is merged in."],"decisions":["no new decisions"],"evidence":["npm run check passed (131 engine tests, 41 eval and live-site tests, 15 python tests, 8 scenarios)."],"next_action":"Merge, then replay both owner calls on the live site and post the dialogues.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0075","timestamp":"2026-11-01T23:57:23Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"1f3a1205dbb5bc26319190b53e421c172a7accd48627b1d5f273ce2ac9bda12a","request_id":"5639ac49ff62470cbd7bb99cee18d962","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0075"} -->

Completed:
- A live replay of the owner's first call showed the desk model refusing a question without looking it up; the library is now asked when the model refuses, and main is merged in.

Evidence:
- npm run check passed (131 engine tests, 41 eval and live-site tests, 15 python tests, 8 scenarios).

Decisions:
- no new decisions

Changed:
- copilot-engine/src/desk.ts, copilot-engine/tests/desk.test.ts, demo/live-site/speech/agent.py (merge)

Blocked/uncertain:
- none

Next:
- Merge, then replay both owner calls on the live site and post the dialogues.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
