# TASK-WCP-0006 — Ringback

<!-- continuity:task {"acceptance":["While the call waits for the agent, the caller hears a soft ringback made in the page","The ringback stops when the agent joins and speaks","With no agent after 20 seconds the call switches to typing with a message","npm run check passes"],"depends_on":[],"goal":"A voice call rings while it connects and falls back to typing when no agent joins","id":"WCP-0006","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/43","next_action":"Open the pull request for #43 and let auto-merge wait for gates","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Callers waited in silence, and forever when the agent was down"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

A voice call rings while it connects and falls back to typing when no agent joins.

## Why

Callers waited in silence, and forever when the agent was down (owner, 2026-10-31).

## Allowed files

- `demo/live-site/widget/sdk.ts`
- `copilot-engine/ledger.jsonl` (rows `npm run check` appends)
- this task file

## Human outcome

A caller hears the line ringing and never sits on a dead "Connecting…".

## Scope and boundaries

- In scope: the ringback tone and the 20-second cutoff in the widget.
- Out of scope: the agent worker itself, and alerting when it is down.
- Dependencies/uncertainty: none.

## Acceptance criteria

- [x] A soft ringback plays from the page while the call waits.
- [x] It stops when the agent's audio arrives or its state leaves waiting.
- [x] With no agent after 20 seconds, the call carries on as text with a message.
- [x] `npm run check` passes.
- [ ] The pull request passes required CI and merges.

## Evidence and sources

- Owner report on 2026-10-31: "Connecting… 0:28", then over a minute, on `localhost:8787/tax`.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #43; parent none; depends on none. Related: #11.
- Primary writer / branch / source issue revision / as-of status: claude-code / `fix/43-ringback` / issue #43 as of 2026-11-01 / open.
- Related PR/CI evidence and push receipt (request ID / SHA): the receipt follows the checkpoint push.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 02:34:18 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["demo/live-site/widget/sdk.ts","copilot-engine/ledger.jsonl"],"completed":["Added a page-made ringback while a voice call waits for the agent, and a 20-second cutoff that switches to typing when no agent joins"],"decisions":["no new decisions"],"evidence":["npm run check passes: lint, typecheck, knip; npm test 33/33; scenarios 8/8"],"next_action":"Open the pull request for #43 and let auto-merge wait for gates","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0006","timestamp":"2026-11-01T02:34:18Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"713674c688a9fba9850b614ae464d3faeb66651c85ef9810c07830faf6650e64","request_id":"25852929c101427689c2ab54656d5197","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0006"} -->

Completed:
- Added a page-made ringback while a voice call waits for the agent, and a 20-second cutoff that switches to typing when no agent joins

Evidence:
- npm run check passes: lint, typecheck, knip; npm test 33/33; scenarios 8/8

Decisions:
- no new decisions

Changed:
- demo/live-site/widget/sdk.ts
- copilot-engine/ledger.jsonl

Blocked/uncertain:
- none

Next:
- Open the pull request for #43 and let auto-merge wait for gates
