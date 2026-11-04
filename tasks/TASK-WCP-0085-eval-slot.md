# TASK-WCP-0085 — Eval Slot

<!-- continuity:task {"acceptance":["The eval slot decides the generator and simulated-caller model, with local meaning the config as before","A script writes model-written draft expectations for replay cases without touching the snapshot","Claude, Gemma and openrouter/free models are refused in the eval"],"depends_on":[],"goal":"Use smart models offline: eval slot and draft expectations for replay cases","id":"WCP-0085","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/81","next_action":"None for this task","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"The loop's tests improve from a smart model without touching the product path (#81, parent #77)"} -->

- Status: completed (merged in #86 as 4e05d3b)
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

### 2026-11-02 00:43:49 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["eval/lib/llm.ts, eval/lib/drafts.ts, eval/draft-expectations.ts, tests, eval/README.md, task record"],"completed":["The eval's generator and simulated callers follow the eval slot, and a script writes model-written draft expectations for replay cases to their own file"],"decisions":["Drafts live in eval/cases/drafts.json and never replace a case's own expectation"],"evidence":["8 new tests pass; npm run check exit 0"],"next_action":"Merge #81","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0085","timestamp":"2026-11-02T00:43:49Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"6d242ab9fa6952d07f8f50e3255430b2eaa6597caef499940a0685e0c8c4f236","request_id":"21ffe217c4984176b9fcfc358554a23b","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0085"} -->

Completed:
- The eval's generator and simulated callers follow the eval slot, and a script writes model-written draft expectations for replay cases to their own file

Evidence:
- 8 new tests pass; npm run check exit 0

Decisions:
- Drafts live in eval/cases/drafts.json and never replace a case's own expectation

Changed:
- eval/lib/llm.ts, eval/lib/drafts.ts, eval/draft-expectations.ts, tests, eval/README.md, task record

Blocked/uncertain:
- none

Next:
- Merge #81

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
