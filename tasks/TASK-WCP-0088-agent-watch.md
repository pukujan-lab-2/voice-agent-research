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
- `demo/live-site/tests/voice-hold.ts`
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

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
