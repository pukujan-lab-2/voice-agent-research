# TASK-WCP-0018 — PROJECT.md follows decision 0011 and loads models by config

<!-- continuity:task {"acceptance":["PROJECT.md rule 3 and the forms bullet in What it does match decision 0011: confirmation by risk score, code lock from 56, skips and submits from 76 asked twice, a person approves from 91","PROJECT.md rule 8 says only the models the active config picks are loaded, and changing the config swaps them"],"depends_on":[],"goal":"PROJECT.md follows decision 0011 and says models load by config","id":"WCP-0018","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/78","next_action":"Open the pull request and arm auto-merge","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"PROJECT.md says the copilot never submits, against decision 0011 and the owner's goal that a voice call does everything; the owner also wants models swapped by config, not all loaded (#78)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

PROJECT.md follows decision 0011 and says models load by config.

## Why

PROJECT.md rule 3 says the copilot never submits a form, but decision 0011 lets it submit after the confirmations a step's risk score requires, and the owner's main goal is a voice call that does everything on a site. The owner also said models must be swapped by config, never all loaded at once (#78).

## Allowed files

- `PROJECT.md`
- `tasks/TASK-WCP-0018-align-confirmation-rules.md`

## Human outcome

PROJECT.md and the decisions agree, so no agent blocks a submit the owner wants, and nobody builds a lab that loads every model at once.

## Scope and boundaries

- In scope: rule 3, the forms bullet, rule 8.
- Out of scope: code; the engine builds to 0011 under #16.

## Acceptance criteria

- [x] Rule 3 and the forms bullet match decision 0011.
- [x] Rule 8 says models load only when the active config picks them.

## Evidence and sources

- The owner's words, quoted on [#78](https://github.com/Pukujan-lab/voice-agent-research/issues/78); decision 0011.

## Related records

- Leaf #78; parent none; depends on #75 (merged); related decision 0011, decision 0012, #71.
- Primary writer / branch: claude-code / `docs/78-align-confirmation-rules`; source issue open as of 2026-11-01.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 08:06:26 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["PROJECT.md rule 3 and the forms bullet follow decision 0011's risk bands; rule 8 says only the models the active config picks are loaded"],"decisions":["no new decisions"],"evidence":["npm run check passes"],"next_action":"Open the pull request and arm auto-merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0018","timestamp":"2026-11-01T08:06:26Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"804e05628c912d60ac7526c45b9865466ecdcd68d98f45bc9c85a08a58d0c20f","request_id":"484aba016af9483dbd82064f9faa56ef","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0018"} -->

Completed:
- PROJECT.md rule 3 and the forms bullet follow decision 0011's risk bands; rule 8 says only the models the active config picks are loaded

Evidence:
- npm run check passes

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Open the pull request and arm auto-merge

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
