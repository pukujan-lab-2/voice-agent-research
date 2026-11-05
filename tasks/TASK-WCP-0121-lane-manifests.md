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

### 2026-11-05 17:55:00 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["agent/, package.json, .github/workflows/ci.yml, .gitignore"],"completed":["Each model lane (strong, hybrid, small) has its own folder and manifest under agent/lanes; a loader in agent/common refuses a bad manifest; import-linter fails the check when one lane imports another or common imports a lane (#164)"],"decisions":["Used import-linter for the boundary and pydantic for the manifest instead of writing our own; guards, fixes and pass bars start empty until step 6 moves each fix into its lane"],"evidence":["npm run test:agent: 12 tests pass and both import contracts are kept; both break when a cross-lane import is added (tried, then undone); npm run check exit 0"],"next_action":"Merge the pull request; then file step 3, the voice stack and language folders","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0121","timestamp":"2026-11-05T17:55:00Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"68fb5e28d65168f79dfab51940ff0eb8fe705636b2949626d20e39d72e28d92b","request_id":"cb0c24859594452c8dd4b3632e920ae0","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0121"} -->

Completed:
- Each model lane (strong, hybrid, small) has its own folder and manifest under agent/lanes; a loader in agent/common refuses a bad manifest; import-linter fails the check when one lane imports another or common imports a lane (#164)

Evidence:
- npm run test:agent: 12 tests pass and both import contracts are kept; both break when a cross-lane import is added (tried, then undone); npm run check exit 0

Decisions:
- Used import-linter for the boundary and pydantic for the manifest instead of writing our own; guards, fixes and pass bars start empty until step 6 moves each fix into its lane

Changed:
- agent/, package.json, .github/workflows/ci.yml, .gitignore

Blocked/uncertain:
- none

Next:
- Merge the pull request; then file step 3, the voice stack and language folders
