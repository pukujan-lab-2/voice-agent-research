# TASK-WCP-0121 — Lane Manifests

<!-- continuity:task {"acceptance": ["agent/lanes/strong, hybrid and small each hold a manifest.json saying what answers, who may reach the lane, its limits, guards, fixes, eval sets, judge, pass bar, search and its own Octo table names", "A loader in agent/common refuses a missing or wrong field, a banned model name, a table another lane uses, or a hand-off to a lane that does not exist", "An import check (import-linter) fails when one lane imports another or common imports a lane", "npm run check and CI run the loader's tests and the import check"], "depends_on": ["WCP-0120"], "goal": "Give each model lane its own folder and manifest, and block imports between lanes", "id": "WCP-0121", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/164", "next_action": "Merge the pull request; then file step 3, the voice stack and language folders", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "Decision 0022 gives each lane its own folder and manifest and bars imports between lanes, but neither the folders nor a check existed (#164)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: WCP-0120

## Goal

Give each model lane its own folder and manifest, and block imports between lanes

## Why

Decision 0022 gives each lane its own folder and manifest and bars imports between lanes, but neither the folders nor a check existed (#164)

## Allowed files

- `agent/` (new)
- `package.json`, `.github/workflows/ci.yml`, `.gitignore`
- this task record

## Human outcome

Each lane has a folder whose manifest says exactly what it runs, and a fix written for one lane cannot be imported by another without CI failing.

## Scope and boundaries

- In scope: the three lane manifests, the loader, the import check and its wiring.
- Out of scope: moving desk code, voice stack folders (step 3), reading the manifests in production.

## Acceptance criteria

- [x] agent/lanes/strong, hybrid and small each hold a manifest.json saying what answers, who may reach the lane, its limits, guards, fixes, eval sets, judge, pass bar, search and its own Octo table names.
- [x] A loader in agent/common refuses a missing or wrong field, a banned model name, a table another lane uses, or a hand-off to a lane that does not exist.
- [x] An import check (import-linter) fails when one lane imports another or common imports a lane.
- [x] npm run check and CI run the loader's tests and the import check.

## Evidence and sources

- `npm run test:agent`: 12 tests pass; the import check keeps both contracts, and breaks both when a lane imports another lane and `common` imports a lane (tried, then undone).
- `npm run check` passes (exit 0).

## Related records

- Leaf: #164. Parent: none. Depends on: #162.
- Primary writer: Claude Code session for the owner / branch `feat/164-lane-manifests` / as of 2026-11-05 PR open.

## Checkpoint log

No checkpoints yet.
