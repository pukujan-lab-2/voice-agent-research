# TASK-WCP-0084 — Smart Desk

<!-- continuity:task {"acceptance":["An ordinary visitor never reaches a smart model","A development host or the owner does, for hard turns only, under a daily cap","A slow or failing smart model leaves the local answer in place","Every desk span names the slot, provider and model"],"depends_on":[],"goal":"Hard desk turns can use a smart model, only for development hosts and the owner, with a daily cap","id":"WCP-0084","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/79","next_action":"Open the pull request, merge, then deploy and test on the VPS","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The live backend cannot use a keyed or hybrid model, and smart slots must never reach an ordinary visitor (#79, parent #77)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Hard desk turns can use a smart model, only for development hosts and the owner, with a daily cap

## Why

The live backend cannot use a keyed or hybrid model, and smart slots must never reach an ordinary visitor (#79, parent #77)

## Allowed files

- `copilot-engine/src/desk.ts`
- `copilot-engine/tests/desk-smart.test.ts`
- `copilot-engine/package.json`
- `demo/live-site/smart.ts`
- `demo/live-site/api.ts`
- `demo/live-site/server.ts`
- `demo/live-site/widget/remote.ts`
- `demo/live-site/widget/sdk.ts`
- `demo/live-site/tests/smart-desk.test.ts`
- `deploy/README.md`
- `tasks/TASK-WCP-0084-smart-desk.md`

## Human outcome

The owner can try a smart hosted model on hard desk turns in development, while no ordinary visitor's call can reach one.

## Scope and boundaries

- In scope: keys on the local model, the escalation, scoping, cap, timeout fallback, span attributes.
- Out of scope: the LiteLLM key (#80), the eval (#81).
- Dependencies/uncertainty: depends on #78 (PR #83), stacked on its branch until it merges.

## Acceptance criteria

- [ ] An ordinary visitor never reaches a smart model
- [ ] A development host or the owner does, for hard turns only, under a daily cap
- [ ] A slow or failing smart model leaves the local answer in place
- [ ] Every desk span names the slot, provider and model

## Evidence and sources

`demo/live-site/tests/smart-desk.test.ts` (13 tests) and `copilot-engine/tests/desk-smart.test.ts` (5 tests) pass.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #79; parent #77; depends on #78; related #80, #81.
- Primary writer / branch: claude-code / `task/WCP-0084-smart-desk`; source issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

### 2026-11-02 00:39:22 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["desk.ts, smart.ts, api.ts, server.ts, widget remote/sdk, tests, deploy/README.md, task record"],"completed":["The desk's hard turns can go to the desk slot's hosted model, only for a development host or the owner, under a daily cap, with the local answer kept on a timeout, and every desk span names the slot, provider and model"],"decisions":["Smart turns are asked by the page only when the server says it may (smart flag on each local answer); DESK_HYBRID=1 is the master switch"],"evidence":["13 backend tests and 5 desk tests pass; npm run check exit 0 at b3cbf7f on current main"],"next_action":"Merge #79; then deploy and run a live test call","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0084","timestamp":"2026-11-02T00:39:22Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"5322114ef78c35bba04f5a8e797d4b0fa27c410e7843344da0c8a20cb3d1b95a","request_id":"3dd7cd2554654f3c94e5eeb0cd7c4374","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0084"} -->

Completed:
- The desk's hard turns can go to the desk slot's hosted model, only for a development host or the owner, under a daily cap, with the local answer kept on a timeout, and every desk span names the slot, provider and model

Evidence:
- 13 backend tests and 5 desk tests pass; npm run check exit 0 at b3cbf7f on current main

Decisions:
- Smart turns are asked by the page only when the server says it may (smart flag on each local answer); DESK_HYBRID=1 is the master switch

Changed:
- desk.ts, smart.ts, api.ts, server.ts, widget remote/sdk, tests, deploy/README.md, task record

Blocked/uncertain:
- none

Next:
- Merge #79; then deploy and run a live test call

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
