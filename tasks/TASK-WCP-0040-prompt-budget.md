# TASK-WCP-0040 — Prompt Budget

<!-- continuity:task {"acceptance":["A form of up to 24 fields produces the same prompt as before and the existing tests pass unchanged","A 300-field form and a 100-turn call keep every model request under 10,000 characters","No collected value is lost or filled into the wrong field"],"depends_on":[],"goal":"The model's prompt stays a fixed size however many fields the form has","id":"WCP-0040","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/101","next_action":"Merge the pull request, then start the bounded-server-state leaf (#102)","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A 300-field form puts hundreds of field lines in front of a small model on every turn (#101)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

The model's prompt stays a fixed size however many fields the form has

## Why

A 300-field form puts hundreds of field lines in front of a small model on every turn (#101)

## Allowed files

- `copilot-engine/src/desk.ts`
- `copilot-engine/tests/desk-scale.test.ts`, `scale-flow.ts`, `scale-report.ts`
- `copilot-engine/package.json` (test script)
- `docs/scaling-limits.md`
- `tasks/TASK-WCP-0040-prompt-budget.md`

## Human outcome

A business can install the copilot on a form with hundreds of fields, and the small model gets the same size of prompt it gets on a 10-field form.

## Scope and boundaries

- In scope: what the model is shown (system prompt, state note, tool schema), caps on the desk's in-memory log and history, tests.
- Out of scope: server state (#102), config storage (#103), site search (#104), model choice.
- Dependencies/uncertainty: none. The 24-field switch-over and the window sizes are starting values; the limits doc says how they were chosen.

## Acceptance criteria

- [ ] Up to 24 fields: prompt unchanged, existing tests pass unchanged.
- [ ] 300 fields and a 100-turn call: every request under 10,000 characters.
- [ ] No value lost or misrouted (tests).
- [ ] Limits written in docs/scaling-limits.md.

## Evidence and sources

Observed on main b9a3e7c with `node tests/scale-report.ts` (largest request while filling a whole form, characters of JSON):

| Fields | Before | After |
|---|---|---|
| 10 | 9,572 | 9,572 |
| 100 | 37,133 | 9,018 |
| 300 | 101,072 | 9,097 |

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #101; parent #100; depends on none.
- Primary writer claude-code / `task/WCP-0040-prompt-budget`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 17:59:02 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/desk.ts, copilot-engine/tests/desk-scale.test.ts, scale-flow.ts, scale-report.ts, docs/scaling-limits.md"],"completed":["A form with 300 fields no longer puts all 300 in the model's prompt: forms over 24 fields show a window of 14 and a count, and a long call keeps a bounded log and history"],"decisions":["no new decisions"],"evidence":["npm run check passes (6 new tests); largest request while filling a whole form: 9,018 characters at 100 fields and 9,097 at 300, was 37,133 and 101,072"],"next_action":"Merge the pull request, then start the bounded-server-state leaf (#102)","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0040","timestamp":"2026-11-01T17:59:02Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"8fb256a8ee39693666d5b004ead1fb629022b4f5768c9cc380e931df5baa7495","request_id":"96810948d70f42c7ac861c34fe1c51c3","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0040"} -->

Completed:
- A form with 300 fields no longer puts all 300 in the model's prompt: forms over 24 fields show a window of 14 and a count, and a long call keeps a bounded log and history

Evidence:
- npm run check passes (6 new tests); largest request while filling a whole form: 9,018 characters at 100 fields and 9,097 at 300, was 37,133 and 101,072

Decisions:
- no new decisions

Changed:
- copilot-engine/src/desk.ts, copilot-engine/tests/desk-scale.test.ts, scale-flow.ts, scale-report.ts, docs/scaling-limits.md

Blocked/uncertain:
- none

Next:
- Merge the pull request, then start the bounded-server-state leaf (#102)

### 2026-11-01 23:28:21 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/desk.ts, copilot-engine/package.json"],"completed":["The prompt-budget branch conflicted with main after the huge-site pull requests merged first; main is merged in and both sides kept"],"decisions":["no new decisions"],"evidence":["npm run check passes after the merge (desk-scale tests included alongside the search and lookup tests)"],"next_action":"Bring #49 (WCP-0041) up to date the same way, then #50 and #51","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0040","timestamp":"2026-11-01T23:28:21Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"7874840df24732281f488e75a0afe7cbce31f05bd11c994f8cedc5c4297648bb","request_id":"a8b33ab2b43f41f998c56bc7fe445b49","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0040"} -->

Completed:
- The prompt-budget branch conflicted with main after the huge-site pull requests merged first; main is merged in and both sides kept

Evidence:
- npm run check passes after the merge (desk-scale tests included alongside the search and lookup tests)

Decisions:
- no new decisions

Changed:
- copilot-engine/src/desk.ts, copilot-engine/package.json

Blocked/uncertain:
- none

Next:
- Bring #49 (WCP-0041) up to date the same way, then #50 and #51

### 2026-11-01 23:32:22 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/package.json"],"completed":["The prompt-budget branch is up to date with main after the conversation-quality pull request merged; every test script kept"],"decisions":["no new decisions"],"evidence":["npm run check passes after the merge"],"next_action":"Bring #49, #50 and #51 up to date in order","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0040","timestamp":"2026-11-01T23:32:22Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"4b969a33fad4ac53ff9d798a4f4c14ad88255c57ebb6b25a749556c8c5f25fa4","request_id":"644386da72bb40478a8216283da4d69e","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0040"} -->

Completed:
- The prompt-budget branch is up to date with main after the conversation-quality pull request merged; every test script kept

Evidence:
- npm run check passes after the merge

Decisions:
- no new decisions

Changed:
- copilot-engine/package.json

Blocked/uncertain:
- none

Next:
- Bring #49, #50 and #51 up to date in order

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
