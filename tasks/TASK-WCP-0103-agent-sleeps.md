# TASK-WCP-0103 — Agent Sleeps

<!-- continuity:task {"acceptance":["The agent's container carries sablier.enable and a health check that passes only after the worker has registered with LiveKit","POST /api/voice/token waits for the agent, up to 30 s, before it returns the token; POST /api/voice/options starts the agent without waiting, at most once a minute","While the agent holds a call it renews its Sablier session every minute, so a call longer than 10 minutes is not cut","A deploy still drains the old agents and never removes the sleeping agent of the release that runs; the deploy tests cover both","Without SABLIER_URL (local runs, tests) nothing is called and nothing changes","After the deploy, docker ps -a --filter label=copilot.role=agent on the VPS shows the agent Exited (0) 10 minutes after the last call, and a call after that is answered"],"depends_on":[],"goal":"Let the voice agent sleep on the VPS between calls and wake when the call button is pressed","id":"WCP-0103","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/117","next_action":"None for this task","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"The agent holds 1.2 GiB all day while calls come in bursts hours apart; the owner asked whether it must stay on, and the answer was no if the call button wakes it (#117)"} -->

- Status: completed (merged in #119 as 6ff45ce)
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Let the voice agent sleep on the VPS between calls and wake when the call button is pressed

## Why

The agent holds 1.2 GiB all day while calls come in bursts hours apart; the owner asked whether it must stay on, and the answer was no if the call button wakes it (#117)

## Allowed files

- `deploy/docker-compose.agent.yml`
- `deploy/docker-compose.vps.yml`
- `deploy/vps/lib.sh`
- `deploy/vps/autodeploy.sh`
- `deploy/test/fake_agent.py`
- `deploy/README.md`
- `demo/live-site/speech/agent.py`
- `demo/live-site/sablier.ts`
- `demo/live-site/server.ts`
- `demo/live-site/widget/sdk.ts`
- `demo/live-site/tests/sablier.test.ts`
- `demo/live-site/tests/deploy-keeps-calls.test.ts`
- `demo/live-site/tests/deploy-sequence.ts`
- `tasks/TASK-WCP-0103-agent-sleeps.md`

## Human outcome

The VPS gets about 1.2 GiB back for the hours between calls. A caller after a quiet spell hears the ringback for a few seconds longer while the agent wakes, and nothing else changes for them.

## Scope and boundaries

- In scope: the agent's labels, health check and in-call renewal; the site's wake calls; the deploy scripts' handling of sleeping agents; tests; deploy/README.md.
- Out of scope: LiveKit, the speech bridges and the Pro's speech server, which stay on; Sablier itself, which server-management owns (its record of this is server-management#115).
- Dependencies/uncertainty: the cold start of a woken agent is measured only after the deploy; LiveKit dispatches a room's job only to workers registered when the room is created, so the wake must finish before the token is handed out.

## Acceptance criteria

- [ ] The agent's container carries sablier.enable and a health check that passes only after the worker has registered with LiveKit
- [ ] POST /api/voice/token waits for the agent, up to 30 s, before it returns the token; POST /api/voice/options starts the agent without waiting, at most once a minute
- [ ] While the agent holds a call it renews its Sablier session every minute, so a call longer than 10 minutes is not cut
- [ ] A deploy still drains the old agents and never removes the sleeping agent of the release that runs; the deploy tests cover both
- [ ] Without SABLIER_URL (local runs, tests) nothing is called and nothing changes
- [ ] After the deploy, docker ps -a --filter label=copilot.role=agent on the VPS shows the agent Exited (0) 10 minutes after the last call, and a call after that is answered

## Evidence and sources

- Cold start: `ssh vps 'grep "registered with LiveKit" ~/apps/copilot/deploy/deploy.log | tail -15'` on 2026-11-03 shows 6 to 14 s for new agents.
- Memory: `ssh vps 'docker stats --no-stream'` on 2026-11-03 08:41 UTC, agent 1.212 GiB.
- LiveKit Agents 1.8.8 in the agent image: `AgentServer` is an EventEmitter and emits `worker_registered` after `registered worker` (`worker.py` line 1300); `cli.run_app` runs the same object.
- Sablier 1.19.1 flags on the VPS: server-management `komodo/resources/platform.toml` (`auto-warm-externally-started=true`, `sessions.default-duration=10m`).

## Related records

- Leaf #117; parent none; depends on none. Related: server-management#115 (the services record), server-management#114 (nyc-map's same pattern), #76 (deploys drain the old agent).
- Primary writer / branch: Claude Code session `agent:claude-code/fc363939-4605-4a1f-8cbf-72beeec584a2` / `task/WCP-0103-agent-sleeps`.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

### 2026-11-03 09:01:53 UTC — agent:claude-code/fc363939-4605-4a1f-8cbf-72beeec584a2

<!-- continuity:checkpoint {"agent":"agent:claude-code/fc363939-4605-4a1f-8cbf-72beeec584a2","blocked":[],"changed":["deploy/docker-compose.agent.yml, deploy/docker-compose.vps.yml, deploy/vps/lib.sh, deploy/vps/autodeploy.sh, deploy/test/fake_agent.py, deploy/README.md, demo/live-site/speech/agent.py, demo/live-site/sablier.ts, demo/live-site/server.ts, demo/live-site/widget/sdk.ts, tests"],"completed":["The voice agent carries the Sablier label and a health check that passes once it has registered with LiveKit; the site wakes it (widget load: start without waiting; call button: wait up to 30 s before the token); the agent renews its session every minute during a call; deploys keep the release's sleeping agent and remove an old release's sleeping one"],"decisions":["Wake by container name (SABLIER_AGENT from deploy/.env), never by group, so old releases' stopped agents are never started","The agent renews its own Sablier session from inside each call (poke every 60 s), so a Sablier stop never lands on an agent that holds a call"],"evidence":["npm run check passes (lint, ruff, tsc, knip, 155+51+78 node tests incl. 5 new Sablier and 6 new or changed deploy tests, pytest 31, speech 11, scenarios 8/8, replay gate ok); docker compose config of both compose files resolves the labels, health check, SABLIER_NAME and the sablier network"],"evidence_class":"observed","next_action":"Open the pull request; after the deploy, check on the VPS that the agent shows Exited (0) 10 minutes after the last call and that a call after a cold start is answered, and time the wake","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0103","timestamp":"2026-11-03T09:01:53Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"a40bccedf46836055bb685ab55321463e7c05daa355e906a9b6613967e2f5524","request_id":"e9925d490df543fe87b5ea517d78fbac","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0103"} -->

Completed:
- The voice agent carries the Sablier label and a health check that passes once it has registered with LiveKit; the site wakes it (widget load: start without waiting; call button: wait up to 30 s before the token); the agent renews its session every minute during a call; deploys keep the release's sleeping agent and remove an old release's sleeping one

Evidence:
- npm run check passes (lint, ruff, tsc, knip, 155+51+78 node tests incl. 5 new Sablier and 6 new or changed deploy tests, pytest 31, speech 11, scenarios 8/8, replay gate ok); docker compose config of both compose files resolves the labels, health check, SABLIER_NAME and the sablier network

Decisions:
- Wake by container name (SABLIER_AGENT from deploy/.env), never by group, so old releases' stopped agents are never started
- The agent renews its own Sablier session from inside each call (poke every 60 s), so a Sablier stop never lands on an agent that holds a call

Changed:
- deploy/docker-compose.agent.yml, deploy/docker-compose.vps.yml, deploy/vps/lib.sh, deploy/vps/autodeploy.sh, deploy/test/fake_agent.py, deploy/README.md, demo/live-site/speech/agent.py, demo/live-site/sablier.ts, demo/live-site/server.ts, demo/live-site/widget/sdk.ts, tests

Blocked/uncertain:
- none

Next:
- Open the pull request; after the deploy, check on the VPS that the agent shows Exited (0) 10 minutes after the last call and that a call after a cold start is answered, and time the wake

### 2026-11-03 09:29:00 UTC — agent:claude-code/fc363939-4605-4a1f-8cbf-72beeec584a2

<!-- continuity:checkpoint {"agent":"agent:claude-code/fc363939-4605-4a1f-8cbf-72beeec584a2","blocked":[],"changed":["deploy/docker-compose.agent.yml, demo/live-site/speech/agent.py, deploy/test/fake_agent.py, deploy/README.md, demo/live-site/tests/deploy-keeps-calls.test.ts"],"completed":["After #118 deployed, the agent slept on time (Sablier stopped it at 09:22:18 UTC, Exited (0)), but the first call after the sleep got no agent: the health-check file from the last run survived in /tmp, so Sablier reported a woken agent ready 7 s before it registered. The file now lives on a tmpfs (/run/agent) that Docker empties on every start"],"decisions":["Keep the ready file on a tmpfs rather than deleting it at Python start, because the first probe runs before Python has loaded its imports"],"evidence":["Live: container started 09:22:53.8, Sablier 'instance is ready' the same second, 'registered worker' at 09:23:01, page 'no agent after 45000 ms'. Local Docker 29.5.2: after stop and start a tmpfs file is gone, a /tmp file remains, and health stays 'starting' until the file is written again. npm run check passes"],"evidence_class":"observed","next_action":"Open the pull request with Closes #117; after the deploy, let the agent sleep and check that the first call after a cold start is answered, and time the wake","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0103","timestamp":"2026-11-03T09:29:00Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"ceb450345bcdf96e69a8be49f8365f5c2409d4f4798a049158fca76dc6331159","request_id":"63504b271ec149399cf29e79d3622d8a","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0103"} -->

Completed:
- After #118 deployed, the agent slept on time (Sablier stopped it at 09:22:18 UTC, Exited (0)), but the first call after the sleep got no agent: the health-check file from the last run survived in /tmp, so Sablier reported a woken agent ready 7 s before it registered. The file now lives on a tmpfs (/run/agent) that Docker empties on every start

Evidence:
- Live: container started 09:22:53.8, Sablier 'instance is ready' the same second, 'registered worker' at 09:23:01, page 'no agent after 45000 ms'. Local Docker 29.5.2: after stop and start a tmpfs file is gone, a /tmp file remains, and health stays 'starting' until the file is written again. npm run check passes

Decisions:
- Keep the ready file on a tmpfs rather than deleting it at Python start, because the first probe runs before Python has loaded its imports

Changed:
- deploy/docker-compose.agent.yml, demo/live-site/speech/agent.py, deploy/test/fake_agent.py, deploy/README.md, demo/live-site/tests/deploy-keeps-calls.test.ts

Blocked/uncertain:
- none

Next:
- Open the pull request with Closes #117; after the deploy, let the agent sleep and check that the first call after a cold start is answered, and time the wake

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
