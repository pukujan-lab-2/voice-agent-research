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

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
