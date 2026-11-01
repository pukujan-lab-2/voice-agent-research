# TASK-WCP-0081 — Voice Stops Hearing

<!-- continuity:task {"acceptance":["A merge to main does not cut a call in progress: the deploy waits for open calls before it replaces the voice agent, and the page rejoins a fresh room if the agent leaves anyway","Every stack in speech/stacks.json has a talk, barge in, talk again test (tests/voice-barge-in.ts); it passes on the live site on lfm3-audio","Speech heard with no turn made of it writes an error span to Phoenix and starts the turn over (stall watchdog, unit-tested)","Every turn writes a voice.turn span within a second, so a killed agent still leaves its turns in Phoenix","What to unload or limit on the Pro is reported on the issue"],"depends_on":[],"goal":"A voice call keeps hearing the caller through a deploy, an agent loss or a stall, on every stack","id":"WCP-0081","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/67","next_action":"Open the pull request, merge, run the live lfm3-audio barge-in test and post the evidence on the issue","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A call on lfm3-audio went deaf when a merge redeployed the agent mid-call (#67)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

A voice call keeps hearing the caller through a deploy, an agent loss or a stall, on every stack

## Why

A call on lfm3-audio went deaf when a merge redeployed the agent mid-call (#67)

## Allowed files

- `deploy/vps/autodeploy.sh`, `deploy/vps/open-calls.py`, `deploy/docker-compose.vps.yml`, `deploy/agent.Dockerfile`
- `demo/live-site/speech/agent.py`, `telemetry.py`, `stall_watchdog.py`, `speech/tests/`
- `demo/live-site/widget/sdk.ts`
- `demo/live-site/tests/voice-barge-in.ts`, `autodeploy-waits-for-calls.test.ts`
- `.github/workflows/ci.yml`, `package.json`, `tasks/TASK-WCP-0081-voice-stops-hearing.md`

## Human outcome

A caller who is mid-call when new work merges keeps being heard, and if the voice agent is ever lost the call recovers by itself or says so, instead of going silent.

## Scope and boundaries

- In scope: the deploy order for the voice agent, the page's reaction to the agent leaving, span flushing, the stall watchdog, the per-stack barge-in test.
- Out of scope: changing anything running on the Pro (reported on the issue only); model comparisons.
- Dependencies/uncertainty: the cause is established by correlation (container timestamps, missing `voice.call` span), not yet reproduced; the first deploy after this merge is the live check of the wait.

## Acceptance criteria

- [ ] A merge to main does not cut a call in progress: the deploy waits for open calls before it replaces the voice agent, and the page rejoins a fresh room if the agent leaves anyway.
- [ ] Every stack in speech/stacks.json has a talk, barge in, talk again test (tests/voice-barge-in.ts); it passes on the live site on lfm3-audio.
- [ ] Speech heard with no turn made of it writes an error span to Phoenix and starts the turn over (stall watchdog, unit-tested).
- [ ] Every turn writes a voice.turn span within a second, so a killed agent still leaves its turns in Phoenix.
- [ ] What to unload or limit on the Pro is reported on the issue.

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf https://github.com/pukujan-lab-2/voice-agent-research/issues/67; parent: none; dependencies: none
- Primary writer / branch / source issue revision / as-of status: Claude Code session (voice stops hearing) / task/WCP-0081-voice-stops-hearing / issue #67 as filed 2026-11-01 / active
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
