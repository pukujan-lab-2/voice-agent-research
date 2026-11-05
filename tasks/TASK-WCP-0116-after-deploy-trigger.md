# TASK-WCP-0116 — After Deploy Trigger

<!-- continuity:task {"acceptance": ["When promote moves production, the after-deploy replay starts for that commit", "A person pushing production by hand still starts it", "When production is already at the commit, no replay starts"], "depends_on": [], "goal": "Every automatic deploy is replayed against the live site", "id": "WCP-0116", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/154", "next_action": "Merge the pull request, then confirm the next deploy starts an after-deploy run", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "promote.yml pushes production with GITHUB_TOKEN, which starts no other workflow, so after-deploy never ran on an automatic deploy (#154)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Every automatic deploy is replayed against the live site

## Why

promote.yml pushes production with GITHUB_TOKEN, which starts no other workflow, so after-deploy never ran on an automatic deploy (#154)

## Allowed files

- `.github/workflows/promote.yml`, `.github/workflows/after-deploy.yml`
- this task record

## Human outcome

A deploy that brings back a fixed bad answer is caught within about 15 minutes, not the next night.

## Scope and boundaries

- In scope: promote starts after-deploy with a workflow dispatch after it moves production.
- Out of scope: the replay itself, Komodo, and an alert when a scheduled check stops running.

## Acceptance criteria

- [x] When promote moves production, the after-deploy replay starts for that commit.
- [x] A person pushing production by hand still starts it (the push trigger stays).
- [x] When production is already at the commit, no replay starts (promote exits before the dispatch).

## Evidence and sources

- Run lists: after-deploy has only two hand-started runs (2026-11-01, 2026-11-02); promote ran five times on 2026-11-05.
- GitHub Docs, "Triggering a workflow from a workflow": GITHUB_TOKEN events start no workflow runs except workflow_dispatch and repository_dispatch.
- `npm run check` passes. Not yet seen on a real deploy.

## Related records

- Leaf: #154. Parent: none. Related: #22.
- Primary writer: Claude Code session for the owner / branch `fix/154-after-deploy-trigger` / as of 2026-11-05 PR open.

## Checkpoint log

No checkpoints yet.
