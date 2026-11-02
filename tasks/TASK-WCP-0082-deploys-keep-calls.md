# TASK-WCP-0082 — Deploys Keep Calls

<!-- continuity:task {"acceptance":["The old voice agent drains and the new one starts first","The site, LiveKit, the bridges and the Pro speech server wait for open calls, bounded","Each deploy records whether it waited, how long and for how many calls","A scratch-project test shows a call survives a deploy and the next call goes to the new container","After merge, a deploy during a live test call does not cut it"],"depends_on":[],"goal":"A deploy never cuts a live call: drain the agent, wait for calls before other restarts, record the wait","id":"WCP-0082","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/76","next_action":"Run npm run check, open the pull request with Closes #76, then run a live test call across a deploy","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Every merge deploys (decision 0016) and calls were cut by it (#67, #76)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

A deploy never cuts a live call: drain the agent, wait for calls before other restarts, record the wait

## Why

Every merge deploys (decision 0016) and calls were cut by it (#67, #76)

## Allowed files

- `deploy/vps/autodeploy.sh`, `deploy/vps/lib.sh`, `deploy/vps/deploy-span.py`, `deploy/vps/open-calls.py`
- `deploy/docker-compose.agent.yml`, `deploy/docker-compose.vps.yml`, `deploy/pro/update.sh`, `deploy/test/`
- `deploy/README.md`, `docs/decisions/0016-merges-go-live.md`
- `demo/live-site/speech/agent.py`, `server.py`, `activity.py`, `speech/tests/test_activity.py`, `demo/live-site/server.ts`
- `demo/live-site/tests/deploy-keeps-calls.test.ts`, `deploy-sequence.ts`, `demo/live-site/package.json`
- `tasks/TASK-WCP-0082-deploys-keep-calls.md`

## Human outcome

A merge that goes live no longer cuts a call someone is on, and when a deploy has to wait or give up, the record says so.

## Scope and boundaries

- In scope: agent drain with an overlapping start, a bounded wait for open calls before the site, LiveKit, bridges and the Pro speech server restart, the deploy record, the tests, the docs.
- Out of scope: the Komodo stack definition in server-management, killing processes on the Pro by hand, model changes.
- Dependencies/uncertainty: Komodo's pre-deploy timeout is unknown; Komodo may remove the old fixed-name `copilot-agent` container once as an orphan.

## Acceptance criteria

- [ ] The old voice agent drains and the new one starts first
- [ ] The site, LiveKit, the bridges and the Pro speech server wait for open calls, bounded
- [ ] Each deploy records whether it waited, how long and for how many calls
- [ ] A scratch-project test shows a call survives a deploy and the next call goes to the new container
- [ ] After merge, a deploy during a live test call does not cut it

## Evidence and sources

LiveKit Agents 1.8.8 source (`livekit/agents/cli/cli.py` `_run_worker`, `worker.py` `drain`, `DRAIN_TIMEOUT = 3600`): the first TERM or INT in `start` mode runs `server.drain()`, which marks the worker full and waits for running jobs. Base `da611d1` on `main`; parent #67 / PR #70.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #76; parent: none; depends on: none; related #67.
- Primary writer / branch: claude-code / `task/WCP-0082-deploys-keep-calls`; issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

### 2026-11-02 00:26:39 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["deploy/vps/autodeploy.sh, lib.sh, deploy-span.py, docker-compose.agent.yml, docker-compose.vps.yml, pro/update.sh, speech/agent.py, server.py, activity.py, server.ts, tests, README, decision 0016"],"completed":["A deploy no longer cuts an open call: the voice agent starts beside the old one and the old one drains, the site, LiveKit and the Pro's speech server wait up to 10 minutes for open calls, and each deploy records whether it waited"],"decisions":["Agent moved out of Komodo's compose file into one compose project per release so a stack deploy cannot replace it; unknown call counts do not block a deploy; Pro update waits whole, not only the restart"],"evidence":["npm run check passes; tests/deploy-keeps-calls.test.ts 21 passed without Docker; tests/deploy-sequence.ts 15 passed on a scratch Docker project with real LiveKit, LiveKit Agents 1.8.8 and a call with audio from say (the call stayed heard across a deploy, the old agent exited with code 0 when its call ended, the next call went to the new container)"],"next_action":"Open the pull request with Closes #76, wait for gates, then run a live test call across a deploy and post the evidence on #76","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0082","timestamp":"2026-11-02T00:26:39Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"9564c124d98098d0d9c1d9e783d651023d8ec39325ecd36b844e1a2d597e7938","request_id":"84cbcd5e792442d29f0bc2bf0d72a5bc","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0082"} -->

Completed:
- A deploy no longer cuts an open call: the voice agent starts beside the old one and the old one drains, the site, LiveKit and the Pro's speech server wait up to 10 minutes for open calls, and each deploy records whether it waited

Evidence:
- npm run check passes; tests/deploy-keeps-calls.test.ts 21 passed without Docker; tests/deploy-sequence.ts 15 passed on a scratch Docker project with real LiveKit, LiveKit Agents 1.8.8 and a call with audio from say (the call stayed heard across a deploy, the old agent exited with code 0 when its call ended, the next call went to the new container)

Decisions:
- Agent moved out of Komodo's compose file into one compose project per release so a stack deploy cannot replace it; unknown call counts do not block a deploy; Pro update waits whole, not only the restart

Changed:
- deploy/vps/autodeploy.sh, lib.sh, deploy-span.py, docker-compose.agent.yml, docker-compose.vps.yml, pro/update.sh, speech/agent.py, server.py, activity.py, server.ts, tests, README, decision 0016

Blocked/uncertain:
- none

Next:
- Open the pull request with Closes #76, wait for gates, then run a live test call across a deploy and post the evidence on #76

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
