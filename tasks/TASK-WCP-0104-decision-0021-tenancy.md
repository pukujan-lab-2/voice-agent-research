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
