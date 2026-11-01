# TASK-WCP-0050 — A merge to main goes live by itself

<!-- continuity:task {"acceptance": ["When CI passes on a push to main, production is fast-forwarded to that commit and Komodo deploys it", "It never forces and stops when production has commits not on main", "Only a CI run on a push to main of this repository promotes", "Decision 0016 and deploy/README.md record the rule"], "depends_on": [], "goal": "A merge to main goes live by itself when CI passes", "id": "WCP-0050", "issue_url": "https://github.com/Pukujan-lab/voice-agent-research/issues/124", "next_action": "Merge once Actions runs again, then check the first promotion", "owner": "owner", "priority": "P2", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "Merged work waited for a hand push of production (#124)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

A merge to `main` goes live by itself when CI passes.

## Why

Merged work waited for someone to push `production` by hand (#124).

## Allowed files

- `.github/workflows/promote.yml` (new)
- `docs/decisions/0016-merges-go-live.md` (new), `docs/decisions/0015-production-branch-deploys.md`, `docs/decisions/README.md`
- `deploy/README.md`, `PROJECT.md` (status table)
- `tasks/TASK-WCP-0050-auto-promote.md`

## Human outcome

The owner merges (or auto-merge does) and the live site updates within about 5 minutes, with no hand push.

## Scope and boundaries

- In scope: the promote workflow and the docs for it.
- Out of scope: automatic revert (the loop's #123 is warn-only), changes in server-management.

## Acceptance criteria

- [ ] CI passing on a push to `main` fast-forwards `production`.
- [ ] It never forces and stops when `production` has diverged.
- [ ] Only a push-to-main CI run promotes.
- [ ] Decision 0016 and the README say so.
- [ ] First promotion checked after GitHub Actions starts runs again.

## Evidence and sources

- GitHub Actions has not started a run since about 17:40 UTC on 2026-11-01, org-wide (queued job on nyc-map-agent, idle runners), so the workflow cannot be run end to end yet.

## Related records

- Leaf #124; parent none; depends on none; related #84, #88, decision 0015.
- Primary writer / branch: claude-code / `feat/124-auto-promote`; source issue open as of 2026-11-01.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
