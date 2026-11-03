# TASK-WCP-0103 — Agent Sleeps

<!-- continuity:task {"acceptance": ["The agent's container carries sablier.enable and a health check that passes only after the worker has registered with LiveKit", "POST /api/voice/token waits for the agent, up to 30 s, before it returns the token; POST /api/voice/options starts the agent without waiting, at most once a minute", "While the agent holds a call it renews its Sablier session every minute, so a call longer than 10 minutes is not cut", "A deploy still drains the old agents and never removes the sleeping agent of the release that runs; the deploy tests cover both", "Without SABLIER_URL (local runs, tests) nothing is called and nothing changes", "After the deploy, docker ps -a --filter label=copilot.role=agent on the VPS shows the agent Exited (0) 10 minutes after the last call, and a call after that is answered"], "depends_on": [], "goal": "Let the voice agent sleep on the VPS between calls and wake when the call button is pressed", "id": "WCP-0103", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/117", "next_action": "open the pull request, then check on the VPS after the deploy that the agent sleeps and a call after a cold start is answered", "owner": "owner", "priority": "P2", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The agent holds 1.2 GiB all day while calls come in bursts hours apart; the owner asked whether it must stay on, and the answer was no if the call button wakes it (#117)"} -->

- Status: active
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

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
