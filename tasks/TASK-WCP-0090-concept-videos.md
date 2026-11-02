# TASK-WCP-0090 — The concept videos play on the live site

<!-- continuity:task {"acceptance": ["Both 720p concept videos are served at /media/ with byte ranges and play", "They survive a redeploy: on the VPS outside git and the image, mounted read-only", "deploy/README.md says where they live and how to replace them"], "depends_on": [], "goal": "The concept videos on the demo home page play on the live site", "id": "WCP-0090", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/98", "next_action": "Merge, then check the live URLs return 200", "owner": "owner", "priority": "P2", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The videos are not in git, so the deployed image had none and both URLs returned 404 (#98)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

The concept videos on the demo home page play on the live site.

## Why

The videos are not in git, so the deployed image had none and `/media/*.mp4` returned 404 (#98).

## Allowed files

- `deploy/docker-compose.vps.yml`, `deploy/README.md`, `tasks/TASK-WCP-0090-concept-videos.md`

## Acceptance criteria

- [x] The two 720p files are on the VPS in `~/apps/copilot-media/`.
- [x] The compose file mounts them read-only; the README says how to replace them.
- [ ] After deploy both URLs return 200 and play.

## Related records

- Leaf #98; parent none. Primary writer / branch: claude-code / `fix/98-concept-videos`.

## Checkpoint log

No checkpoints yet.

### 2026-11-02 02:21:13 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["The concept videos returned 404 on the live site because they are not in git; the two web-sized files are now on the VPS and mounted read-only into copilot-web"],"decisions":["no new decisions"],"evidence":["Files copied to the VPS; compose file validates"],"next_action":"Merge, then check both /media URLs return 200","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0090","timestamp":"2026-11-02T02:21:13Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"bfb439e32f7ad8ab775d1e923c828ec1b0b162cc0069c53f9d192d5de5a97288","request_id":"1d84a205e2db47dc8936b383b5dc0213","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0090"} -->

Completed:
- The concept videos returned 404 on the live site because they are not in git; the two web-sized files are now on the VPS and mounted read-only into copilot-web

Evidence:
- Files copied to the VPS; compose file validates

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Merge, then check both /media URLs return 200

### 2026-11-02 02:21:22 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["The concept videos returned 404 on the live site because they are not in git; the two web-sized files are on the VPS and mounted read-only into copilot-web"],"decisions":["no new decisions"],"evidence":["Files copied to the VPS; compose file validates"],"next_action":"Merge, then check both /media URLs return 200","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0090","timestamp":"2026-11-02T02:21:22Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"d16495da95a0e355e96c6ea17080b1787567e000ad2c1fccd45055bcc3ee665c","request_id":"002196e73b064eeb8988ef8c5d131cac","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0090"} -->

Completed:
- The concept videos returned 404 on the live site because they are not in git; the two web-sized files are on the VPS and mounted read-only into copilot-web

Evidence:
- Files copied to the VPS; compose file validates

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Merge, then check both /media URLs return 200

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
