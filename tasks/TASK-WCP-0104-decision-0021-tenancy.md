# TASK-WCP-0104 — Decision 0021 Tenancy

<!-- continuity:task {"acceptance": ["docs/decisions/0021-adopters-own-a-workspace.md exists with Status Accepted and links #121", "The decision index lists 0021", "npm run check passes and the pull request merges through required CI"], "depends_on": [], "goal": "Record decision 0021: each adopter owns a workspace, the factory owns the code and the registry", "id": "WCP-0104", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/121", "next_action": "merge pull request #122 through CI, then start phase 0 of #121 with the customer memory re-key", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The owner asked what adopters own against the factory and said 'Yes, file both' on 2026-11-04; returning-customer memory is keyed without the business id today"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Record decision 0021: each adopter owns a workspace, the factory owns the code and the registry

## Why

The owner asked what adopters own against the factory and said "Yes, file both" on 2026-11-04; returning-customer memory is keyed without the business id today

## Allowed files

- `docs/decisions/0021-adopters-own-a-workspace.md`
- `docs/decisions/README.md`
- `tasks/TASK-WCP-0104-decision-0021-tenancy.md`

## Human outcome

Anyone building the tenancy work in #121 has one written answer to who owns what, so the phases are built to one plan.

## Scope and boundaries

- In scope: the decision record and its index row.
- Out of scope: any code; the phases themselves are children of #121.
- Dependencies/uncertainty: counsel items listed in the decision stay open for the owner.

## Acceptance criteria

- [ ] docs/decisions/0021-adopters-own-a-workspace.md exists with Status Accepted and links #121
- [ ] The decision index lists 0021
- [ ] npm run check passes and the pull request merges through required CI

## Evidence and sources

- Research saved in Octo as `research/multi-tenant-roles-and-data-tiers-2026-11-04.md`.
- `copilot-engine/src/memory.ts:87-90` keys customer memory without the business id.

### 2026-11-04 19:34:49 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["decision 0021 and index row; epic #121 filed; PR #122 opened"],"decisions":["no new decisions"],"evidence":["npm run check exit 0 locally"],"next_action":"merge PR #122 through CI, then phase 0 memory re-key from #121","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0104","timestamp":"2026-11-04T19:34:49Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"4e98d05b875087ceef50836dda425e4dd3ab2ffd81c1b2e0adb66c7b34dbda59","request_id":"50dbde593bec4199a2dff209ff00f10b","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0104"} -->

Completed:
- decision 0021 and index row; epic #121 filed; PR #122 opened

Evidence:
- npm run check exit 0 locally

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- merge PR #122 through CI, then phase 0 memory re-key from #121

### 2026-11-04 19:34:56 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["decision 0021 and index row; epic #121 filed; PR #122 opened"],"decisions":["no new decisions"],"evidence":["npm run check exit 0 locally"],"next_action":"merge PR #122 through CI, then phase 0 memory re-key from #121","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0104","timestamp":"2026-11-04T19:34:56Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"4e98d05b875087ceef50836dda425e4dd3ab2ffd81c1b2e0adb66c7b34dbda59","request_id":"50dbde593bec4199a2dff209ff00f10b","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0104"} -->

Completed:
- decision 0021 and index row; epic #121 filed; PR #122 opened

Evidence:
- npm run check exit 0 locally

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- merge PR #122 through CI, then phase 0 memory re-key from #121
