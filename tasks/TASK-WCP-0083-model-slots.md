# TASK-WCP-0083 — Model Slots

<!-- continuity:task {"acceptance":["A bad slot file or env stops the start with a message naming the slot","No file and no env: every slot is the local model","Models named claude, gemma or openrouter/free are rejected","Decision 0017 and the deploy README section exist"],"depends_on":[],"goal":"A validated model-slot file names a provider and model per task","id":"WCP-0083","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/78","next_action":"Open the pull request; then build the live wiring (#79) on this","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The owner wants smart models in development with LFM3 the default (#78, parent #77)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

A validated model-slot file names a provider and model per task

## Why

The owner wants smart models in development with LFM3 the default (#78, parent #77)

## Allowed files

- `copilot-engine/src/slots.ts`
- `copilot-engine/tests/slots.test.ts`
- `copilot-engine/package.json`
- `demo/live-site/model-slots.json`
- `docs/decisions/0017-smart-model-slots-for-development.md`
- `docs/decisions/README.md`
- `deploy/README.md`
- `tasks/TASK-WCP-0083-model-slots.md`

## Human outcome

The owner can name a smart hosted model per task in one validated file, with LFM3 the default and the models the product may not use refused by name.

## Scope and boundaries

- In scope: the slot file format, its validation, env overrides, the allow-list, decision 0017, the README section.
- Out of scope: using the slots in the backend or the eval (#79, #81).
- Dependencies/uncertainty: none

## Acceptance criteria

- [ ] A bad slot file or env stops the start with a message naming the slot
- [ ] No file and no env: every slot is the local model
- [ ] Models named claude, gemma or openrouter/free are rejected
- [ ] Decision 0017 and the deploy README section exist

## Evidence and sources

`copilot-engine/tests/slots.test.ts`: 11 tests, all pass (`node --test`), run against `5476a0c` plus this change.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #78; parent #77; depends on none; children of #77: #79, #80, #81.
- Primary writer / branch: claude-code / `task/WCP-0083-model-slots`; source issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
