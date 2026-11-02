# TASK-WCP-0082 — Guide Offers

<!-- continuity:task {"acceptance":["A question about filing \"from here\" is answered with the site's form offer and a yes opens it", "A deadline or due-date question gets no booking offer", "A short question on a topic with a site form is looked up, not asked back", "A typed \"Hmm.\" is not a turn", "npm run check passes; a live replay after deploy shows all four"],"depends_on":[],"goal":"Open the site's form when a visitor asks to file from here and fix three small mistakes found by a live replay","id":"WCP-0082","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/74","next_action":"Merge, then replay both owner calls on the live site","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A live replay of both owner calls: a model promise nothing keeps, a booking offer on date questions, a form topic asked back (#74)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Open the site's form when a visitor asks to file from here and fix three small mistakes found by a live replay

## Why

A live replay of both owner calls: a model promise nothing keeps, a booking offer on date questions, a form topic asked back (#74)

## Allowed files

- `copilot-engine/src/dialogue.ts`
- `copilot-engine/tests/dialogue.test.ts`
- `demo/live-site/widget/sdk.ts`
- `eval/tests/conversation.test.ts`
- `tasks/TASK-WCP-0082-guide-offers.md`

## Human outcome

A visitor who asks to file from the site is offered the site's form and gets it on a yes.

## Scope and boundaries

- In scope: the four mistakes of #74.
- Out of scope: which passage the judge picks.
- Dependencies/uncertainty: none. Parent: none.

## Acceptance criteria

- [ ] A question about filing "from here" is answered with the site's form offer and a yes opens it
- [ ] A deadline or due-date question gets no booking offer
- [ ] A short question on a topic with a site form is looked up, not asked back
- [ ] A typed "Hmm." is not a turn
- [ ] npm run check passes; a live replay after deploy shows all four

## Evidence and sources

Live replays of both owner calls with `demo/live-site/tests/live-replay.ts` on the deploy of da611d1.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #74; parent: none; related #66, #24.
- Primary writer claude-code / branch `task/WCP-0082-guide-offers` / issue open as of 2026-11-02.
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

### 2026-11-02 00:06:09 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/dialogue.ts, demo/live-site/widget/sdk.ts, tests"],"completed":["A live replay of both owner calls found a model promise nothing keeps, booking offers on date questions, a form topic asked back and a typed Hmm answered as a greeting; code now answers those."],"decisions":["no new decisions"],"evidence":["npm run check passed (134 engine tests, 42 eval and live-site tests, 15 python tests, 8 scenarios)."],"next_action":"Merge, then replay both owner calls on the live site.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0082","timestamp":"2026-11-02T00:06:09Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"b2433b770c1d1d92d97cf0dfa6b255b1bf903ac7783ce9c49c1422caef2022e4","request_id":"ce09dfac6cd44be5a1d3140b0b30d39c","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0082"} -->

Completed:
- A live replay of both owner calls found a model promise nothing keeps, booking offers on date questions, a form topic asked back and a typed Hmm answered as a greeting; code now answers those.

Evidence:
- npm run check passed (134 engine tests, 42 eval and live-site tests, 15 python tests, 8 scenarios).

Decisions:
- no new decisions

Changed:
- copilot-engine/src/dialogue.ts, demo/live-site/widget/sdk.ts, tests

Blocked/uncertain:
- none

Next:
- Merge, then replay both owner calls on the live site.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
