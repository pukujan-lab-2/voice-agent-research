# TASK-WCP-0010 — Confirmation policy

<!-- continuity:task {"acceptance":["Decision 0011 replaces 0003 with the model-led policy and the 1 to 100 risk scale","It records that the NYC map agent is low stakes","It cites Mycroft, LiveKit and OpenAI's agent guide","0003 is marked replaced and the index is updated"],"depends_on":[],"goal":"Record the owner's confirmation policy: the model leads, a 1 to 100 risk score sets how it confirms","id":"WCP-0010","next_action":"Open the pull request for #52 and arm auto-merge","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Decision 0003 has code own every confirmation, which no longer matches the owner's direction"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Record the owner's confirmation policy: the model leads, a 1 to 100 risk score sets how it confirms.

## Why

Decision 0003 has code own every read-back and confirmation, which no longer matches the owner's direction of 2026-10-31 (#52).

## Allowed files

- `docs/decisions/0003-one-small-decision-per-turn.md`, `docs/decisions/0011-model-leads-risk-sets-confirmation.md`, `docs/decisions/README.md`
- `copilot-engine/ledger.jsonl` (rows `npm run check` appends)
- this task file

## Human outcome

Anyone building the desk (#16) or another agent knows how much each action must be confirmed, and why.

## Scope and boundaries

- In scope: the decision records.
- Out of scope: engine and widget code; #16 carries those.
- Dependencies/uncertainty: the band limits are the owner's starting point and may be edited.

## Acceptance criteria

- [x] Decision 0011 replaces 0003 with the model-led policy and the 1 to 100 risk scale.
- [x] It records that the NYC map agent is low stakes.
- [x] It cites Mycroft, LiveKit and OpenAI's agent guide.
- [x] 0003 is marked replaced and the index is updated.

## Evidence and sources

- Mycroft confirmations page, LiveKit prompting guide, and OpenAI's guide ("Guardrails", "Plan for human intervention"), read 2026-11-01.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #52; parent none; depends on none. Related: #16, #37.
- Primary writer / branch / source issue revision / as-of status: claude-code / `docs/52-confirmation-policy` / issue #52 as of 2026-11-01 / open.
- Related PR/CI evidence and push receipt (request ID / SHA): the receipt follows the checkpoint push.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 03:11:14 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["docs/decisions/0011-model-leads-risk-sets-confirmation.md","docs/decisions/0003-one-small-decision-per-turn.md","docs/decisions/README.md"],"completed":["Wrote decision 0011, replacing 0003: the model leads and a 1 to 100 risk score sets how it confirms"],"decisions":["Owner's 1 to 100 risk scale and bands recorded in 0011"],"evidence":["npm run check passes: lint, typecheck, knip, engine tests, scenarios 8/8"],"next_action":"Open the pull request for #52 and arm auto-merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0010","timestamp":"2026-11-01T03:11:14Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"7a818a3393c2b7b664e84f4babe861274a7fb060af2d64b234186d9a78022077","request_id":"d502bb65414d479fad4bd999f3e4264b","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0010"} -->

Completed:
- Wrote decision 0011, replacing 0003: the model leads and a 1 to 100 risk score sets how it confirms

Evidence:
- npm run check passes: lint, typecheck, knip, engine tests, scenarios 8/8

Decisions:
- Owner's 1 to 100 risk scale and bands recorded in 0011

Changed:
- docs/decisions/0011-model-leads-risk-sets-confirmation.md
- docs/decisions/0003-one-small-decision-per-turn.md
- docs/decisions/README.md

Blocked/uncertain:
- none

Next:
- Open the pull request for #52 and arm auto-merge
