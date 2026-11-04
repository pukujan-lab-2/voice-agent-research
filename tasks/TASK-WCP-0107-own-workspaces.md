# TASK-WCP-0107 — Own Workspaces

<!-- continuity:task {"acceptance": ["Adding an outside business to the registry creates its Octo workspace and stores the workspace id in that business's registry entry; a retried add reuses the same workspace", "A put can never point a business at a workspace the factory did not create for it, or move a business off its own workspace", "That business's config, resume sessions and traces are read and written in its own workspace", "A plain-code test runs a test business's chat end to end in its own workspace, and the shared workspace gains no rows for it", "Demo businesses keep working on the shared workspace with their prefix"], "depends_on": [], "goal": "Give each outside business its own Octo workspace, created from its config", "id": "WCP-0107", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/127", "next_action": "create the worktree with continuity worktree create WCP-0107, then add workspace creation to the registry put", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "Every business lives in one shared Octo workspace told apart by a prefix; one wrong query shows a business another's callers. Outside businesses can't go live until each has its own (#127, decision 0021 settlement 1)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Give each outside business its own Octo workspace, created from its config

## Why

Every business lives in one shared Octo workspace told apart by a prefix; one wrong query shows a business another's callers. Outside businesses can't go live until each has its own (#127, decision 0021 settlement 1)

## Allowed files

- copilot-engine/src/site-config.ts
- copilot-engine/src/octo-workspaces.ts
- copilot-engine/tests/site-config.test.ts
- demo/live-site/api.ts
- demo/live-site/server.ts
- demo/live-site/tracing.ts
- demo/live-site/tools/site-config.ts
- demo/live-site/tests/own-workspace.test.ts
- tasks/TASK-WCP-0107-own-workspaces.md

## Human outcome

An outside business's callers, sessions and traces sit in a workspace of its own, so no query for another business can reach them; the factory's demo businesses work as before.

## Scope and boundaries

- In scope: creating the workspace from the registry's put, storing its id in the registry entry, routing that business's config, resume sessions and traces to it, tests.
- Out of scope: engine-side isolation (octo-database#10), encryption (phase 1, #128), the onboarding screen, the voice agent's own traces (speech/telemetry.py; a follow-up).
- Dependencies/uncertainty: needs the account-wide Octo key (saved 2026-11-04). Octo allows one new workspace per day per account and deleting one needs a human session with MFA, so tests use a fake Octo and create no live workspace.

## Acceptance criteria

- [ ] Adding an outside business to the registry creates its Octo workspace and stores the workspace id in that business's registry entry; a retried add reuses the same workspace
- [ ] A put can never point a business at a workspace the factory did not create for it, or move a business off its own workspace
- [ ] That business's config, resume sessions and traces are read and written in its own workspace
- [ ] A plain-code test runs a test business's chat end to end in its own workspace, and the shared workspace gains no rows for it
- [ ] Demo businesses keep working on the shared workspace with their prefix

## Evidence and sources

Starting revision f5d0c94 (main after #134). Octo's create route: `POST /api/workspaces` with `{ name, slug, description }` answers 201 with `workspace.id` and a one-time workspace key, 409 SLUG_TAKEN, 429 WORKSPACE_DAILY_LIMIT (pukujan-lab-2/octo-database `src/routes/workspaces.ts`).

## Reproduction details (only when needed)

Not needed.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #127; parent #121; depends on #28 (done) and pukujan-lab-2/octo-database#10 (engine-side isolation, open, not blocking this code)
- Primary writer / branch / source issue revision / as-of status: Claude Code side session of local_a2ffa57e / task/WCP-0107-own-workspaces / #127 as filed 2026-11-04 / active
- Related PR/CI evidence and push receipt (request ID / SHA): pending

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
