# TASK-WCP-0008 — Capability questions

<!-- continuity:task {"acceptance":["Questions about the assistant get a short answer about what it does, with no guide search","Real questions that start the same way still go to the guides","npm run check passes"],"depends_on":[],"goal":"Questions about the assistant get a real answer, not a guide search","id":"WCP-0008","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/48","next_action":"Open the pull request for #48 and let auto-merge wait for gates","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"\"Can I ask you about taxes?\" got unrelated IRS passages (owner, 2026-10-31)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Questions about the assistant get a real answer, not a guide search.

## Why

"Can I ask you about taxes?" got unrelated IRS passages (owner, 2026-10-31).

## Allowed files

- `demo/live-site/widget/sdk.ts`
- `copilot-engine/ledger.jsonl` (rows `npm run check` appends)
- this task file

## Human outcome

A caller's opening "what can I ask you?" gets a sensible answer.

## Scope and boundaries

- In scope: a "help" kind in the small-talk list and its answer.
- Out of scope: wiring in the model-led desk (#16).
- Dependencies/uncertainty: a phrase list only covers what it lists.

## Acceptance criteria

- [x] Questions about the assistant get a short answer and an invitation to ask.
- [x] "Can I ask about how to file an extension" and "can I ask you about my refund status" still go to the guides.
- [x] `npm run check` passes.
- [ ] The pull request passes required CI and merges.

## Evidence and sources

- Owner screenshot, 2026-10-31: IRS Publication 970 opened for "can I ask you about taxes?".

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #48; parent none; depends on none. Related: #16, #12.
- Primary writer / branch / source issue revision / as-of status: claude-code / `fix/48-capability-questions` / issue #48 as of 2026-11-01 / open.
- Related PR/CI evidence and push receipt (request ID / SHA): the receipt follows the checkpoint push.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 02:44:49 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["demo/live-site/widget/sdk.ts","copilot-engine/ledger.jsonl"],"completed":["Added a help kind to the widget's small-talk list so questions about the assistant get a short answer instead of a guide search"],"decisions":["no new decisions"],"evidence":["npm run check passes: lint, typecheck, knip; npm test 33/33; scenarios 8/8; 10 phrasings checked by hand: 7 answered as help, 3 real questions still searched"],"next_action":"Open the pull request for #48 and let auto-merge wait for gates","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0008","timestamp":"2026-11-01T02:44:49Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"ba358637bbf8056adc8b8472155be9f764d183ee55bf79e8e03ab690434d626e","request_id":"7938069e55f74188bca78807d809912e","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0008"} -->

Completed:
- Added a help kind to the widget's small-talk list so questions about the assistant get a short answer instead of a guide search

Evidence:
- npm run check passes: lint, typecheck, knip; npm test 33/33; scenarios 8/8; 10 phrasings checked by hand: 7 answered as help, 3 real questions still searched

Decisions:
- no new decisions

Changed:
- demo/live-site/widget/sdk.ts
- copilot-engine/ledger.jsonl

Blocked/uncertain:
- none

Next:
- Open the pull request for #48 and let auto-merge wait for gates
