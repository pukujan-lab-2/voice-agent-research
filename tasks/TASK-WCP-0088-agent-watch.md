# TASK-WCP-0088 — Agent Watch

<!-- continuity:task {"acceptance":["A reconnect that emits a disconnect for the agent, with the agent still in the room, does not restart the call", "An agent that is really gone is treated as lost after the wait, once", "A dropped connection tries the same room with the same token before falling back; the two-rejoin limit and typing fallback stay", "voice-hold.ts's fake microphone has a noise floor", "npm run check passes"],"depends_on":[],"goal":"Do not treat a reconnect as the voice agent leaving the call","id":"WCP-0088","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/95","next_action":"Merge, then report on #93; a spoken or held call confirms it","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A reconnect mid-call restarts it though the agent never left (#95)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Do not treat a reconnect as the voice agent leaving the call

## Why

A reconnect mid-call restarts it though the agent never left (#95)

## Allowed files

- `demo/live-site/widget/agent-watch.ts`
- `demo/live-site/widget/sdk.ts`
- `demo/live-site/tests/agent-watch.test.ts`
- `demo/live-site/tests/voice-hold.ts` (already fixed upstream)
- `tasks/TASK-WCP-0088-agent-watch.md`

## Human outcome

A visitor whose connection reconnects mid-call keeps the call instead of being restarted and then dropped to typing.

## Scope and boundaries

- In scope: the widget's handling of agent disconnect and connection drop, and the test driver's silence.
- Out of scope: the agent's side (#94).
- Dependencies/uncertainty: none. Parent: none.

## Acceptance criteria

- [ ] A reconnect that emits a disconnect for the agent, with the agent still in the room, does not restart the call
- [ ] An agent that is really gone is treated as lost after the wait, once
- [ ] A dropped connection tries the same room with the same token before falling back; the two-rejoin limit and typing fallback stay
- [ ] voice-hold.ts's fake microphone has a noise floor
- [ ] npm run check passes

## Evidence and sources

Evidence from the voice-agent session on #93 (LiveKit server log, browser console of a held call).

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #95; parent: none; related #93, #94.
- Primary writer claude-code / branch `task/WCP-0088-agent-watch` / issue open as of 2026-11-02.
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

### 2026-11-02 02:15:59 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["demo/live-site/widget/agent-watch.ts, widget/sdk.ts, tests/agent-watch.test.ts, tests/voice-hold.ts"],"completed":["A reconnect made the page think the voice agent had left and restart the call; the page now waits for the reconnect, checks the room, and tries the same room again on a dropped connection."],"decisions":["no new decisions"],"evidence":["npm run check passed (153 engine tests, 51 eval and live-site tests incl. 5 new agent-watch tests, 15 python tests, 8 scenarios)."],"next_action":"Merge, then report on #93; a held or spoken call confirms it.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0088","timestamp":"2026-11-02T02:15:59Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"749bb8662f0ce2d6895534dae69994036dbcda57a975b24b4378681d59df490b","request_id":"bce762a5bbb042cdbea47ca5756f2f2d","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0088"} -->

Completed:
- A reconnect made the page think the voice agent had left and restart the call; the page now waits for the reconnect, checks the room, and tries the same room again on a dropped connection.

Evidence:
- npm run check passed (153 engine tests, 51 eval and live-site tests incl. 5 new agent-watch tests, 15 python tests, 8 scenarios).

Decisions:
- no new decisions

Changed:
- demo/live-site/widget/agent-watch.ts, widget/sdk.ts, tests/agent-watch.test.ts, tests/voice-hold.ts

Blocked/uncertain:
- none

Next:
- Merge, then report on #93; a held or spoken call confirms it.

### 2026-11-02 02:17:09 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["demo/live-site/widget/agent-watch.ts, widget/sdk.ts, tests/agent-watch.test.ts"],"completed":["A reconnect made the page think the voice agent had left and restart the call; the page now waits for the reconnect, checks the room, and tries the same room again on a dropped connection. main merged in; voice-hold.ts already had the noise floor."],"decisions":["no new decisions"],"evidence":["npm run check passed (153 engine tests, 51 eval and live-site tests incl. 5 new agent-watch tests, 15 python tests, 8 scenarios)."],"next_action":"Merge, then report on #93; a held or spoken call confirms it.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0088","timestamp":"2026-11-02T02:17:09Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"3ab5184d3e0ad6dffbf2680ff63a84a433aa08dc43e81ebb27cc4a0aaddfcc0a","request_id":"98a648a835534d639227fd9aa07b7cf3","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0088"} -->

Completed:
- A reconnect made the page think the voice agent had left and restart the call; the page now waits for the reconnect, checks the room, and tries the same room again on a dropped connection. main merged in; voice-hold.ts already had the noise floor.

Evidence:
- npm run check passed (153 engine tests, 51 eval and live-site tests incl. 5 new agent-watch tests, 15 python tests, 8 scenarios).

Decisions:
- no new decisions

Changed:
- demo/live-site/widget/agent-watch.ts, widget/sdk.ts, tests/agent-watch.test.ts

Blocked/uncertain:
- none

Next:
- Merge, then report on #93; a held or spoken call confirms it.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
