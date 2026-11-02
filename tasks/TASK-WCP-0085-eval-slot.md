# TASK-WCP-0085 — Eval Slot

<!-- continuity:task {"acceptance":["The eval slot decides the generator and simulated-caller model, with local meaning the config as before","A script writes model-written draft expectations for replay cases without touching the snapshot","Claude, Gemma and openrouter/free models are refused in the eval"],"depends_on":[],"goal":"Use smart models offline: eval slot and draft expectations for replay cases","id":"WCP-0085","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/81","next_action":"Open the pull request and merge; run the draft script once a key exists","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The loop's tests improve from a smart model without touching the product path (#81, parent #77)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Use smart models offline: eval slot and draft expectations for replay cases

## Why

The loop's tests improve from a smart model without touching the product path (#81, parent #77)

## Allowed files

- `eval/lib/llm.ts`
- `eval/lib/drafts.ts`
- `eval/draft-expectations.ts`
- `eval/tests/drafts.test.ts`
- `eval/README.md`
- `tasks/TASK-WCP-0085-eval-slot.md`

## Human outcome

The loop's tests can be written and checked with a smart model offline, labelled as model-written, with the product path untouched.

## Scope and boundaries

- In scope: the eval slot in `chat`, the `litellm` provider, the draft script and tests.
- Out of scope: the product path, scoring one model against another, the gateway key (#80).
- Dependencies/uncertainty: depends on #78 (merged, #83).

## Acceptance criteria

- [ ] The eval slot decides the generator and simulated-caller model, with local meaning the config as before
- [ ] A script writes model-written draft expectations for replay cases without touching the snapshot
- [ ] Claude, Gemma and openrouter/free models are refused in the eval

## Evidence and sources

`eval/tests/drafts.test.ts`: 8 tests pass (no network).

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #81; parent #77; depends on #78; related #79, #80.
- Primary writer / branch: claude-code / `task/WCP-0085-eval-slot`; source issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
