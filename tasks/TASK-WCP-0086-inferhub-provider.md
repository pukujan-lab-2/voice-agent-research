# TASK-WCP-0086 — Inferhub Provider

<!-- continuity:task {"acceptance":["Slot provider inferhub accepts only DeepSeek and Qwen routes","The VPS desk slot points at an InferHub route and a live call shows it in Phoenix","deploy/README.md says what limits exist"],"depends_on":[],"goal":"An inferhub provider for the model slots, in place of a LiteLLM virtual key","id":"WCP-0086","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/80","next_action":"Merge, set the VPS slot, run a live call and post the table on #77","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The owner chose a direct InferHub call over a dedicated gateway; the shared gateway has no master key (#80, parent #77)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

An inferhub provider for the model slots, in place of a LiteLLM virtual key

## Why

The owner chose a direct InferHub call over a dedicated gateway; the shared gateway has no master key (#80, parent #77)

## Allowed files

- `copilot-engine/src/slots.ts`
- `copilot-engine/tests/slots.test.ts`
- `demo/live-site/api.ts`
- `demo/live-site/server.ts`
- `eval/lib/llm.ts`
- `docs/decisions/0017-smart-model-slots-for-development.md`
- `deploy/README.md`
- `tasks/TASK-WCP-0086-inferhub-provider.md`

## Human outcome

DeepSeek and Qwen routes can be used from a slot directly, with no gateway in between.

## Scope and boundaries

- In scope: the `inferhub` provider, docs, the VPS slot setting.
- Out of scope: a second LiteLLM gateway, an InferHub budget (dashboard, owner's).
- Dependencies/uncertainty: depends on #78; `ali/*-flash` routes did not serve on 2026-11-02.

## Acceptance criteria

- [ ] Slot provider inferhub accepts only DeepSeek and Qwen routes
- [ ] The VPS desk slot points at an InferHub route and a live call shows it in Phoenix
- [ ] deploy/README.md says what limits exist

## Evidence and sources

Owner direction recorded on #80 (https://github.com/pukujan-lab-2/voice-agent-research/issues/80#issuecomment-6566599150). Four InferHub routes answered a tool call from the VPS on 2026-11-02.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #80; parent #77; depends on #78; supersedes #80's virtual-key criteria (owner direction).
- Primary writer / branch: claude-code / `task/WCP-0086-inferhub`; source issue open as of 2026-11-02.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

### 2026-11-02 01:05:34 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["slots.ts and tests, api/server env names, eval llm.ts, decision 0017, deploy/README.md, task record"],"completed":["Model slots can call InferHub directly for DeepSeek and Qwen routes, per the owner's choice over a dedicated gateway"],"decisions":["Owner direction on #80: direct InferHub, no LiteLLM virtual key"],"evidence":["slot tests extended; npm run check exit 0"],"next_action":"Merge, set the VPS slot, run a live call","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0086","timestamp":"2026-11-02T01:05:34Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"d73543118b9103db16c1495048b1fc241c232c03e4eab9459db2ff120838ae0f","request_id":"a3596bfe9a534cf39d9c65f4953a2ce0","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0086"} -->

Completed:
- Model slots can call InferHub directly for DeepSeek and Qwen routes, per the owner's choice over a dedicated gateway

Evidence:
- slot tests extended; npm run check exit 0

Decisions:
- Owner direction on #80: direct InferHub, no LiteLLM virtual key

Changed:
- slots.ts and tests, api/server env names, eval llm.ts, decision 0017, deploy/README.md, task record

Blocked/uncertain:
- none

Next:
- Merge, set the VPS slot, run a live call

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
