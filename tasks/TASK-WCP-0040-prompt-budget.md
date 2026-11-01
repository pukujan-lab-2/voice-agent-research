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

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
