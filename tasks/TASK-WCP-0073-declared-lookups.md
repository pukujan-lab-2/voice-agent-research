# TASK-WCP-0073 — Declared Lookups

<!-- continuity:task {"acceptance":["Only declared fields are returned","Injection attempts and cross-business reads fail (tests)","A person-lookup is refused until the caller is verified"],"depends_on":[],"goal":"A business declares read-only record lookups that code runs safely with risk scores","id":"WCP-0073","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/35","next_action":"Start the leaf on its task branch","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Nothing reads an order, appointment or price from a table (#35)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

A business declares read-only record lookups that code runs safely with risk scores

## Why

Nothing reads an order, appointment or price from a table (#35)

## Allowed files

- `copilot-engine/src/lookups.ts` (new)
- `schemas/lookups.schema.json` (new)
- `copilot-engine/tests/lookups.test.ts`
- `docs/lookups.md`
- `tasks/TASK-WCP-0073-declared-lookups.md`

## Human outcome

A business can let the copilot look up an order, appointment or price without the model ever writing SQL or seeing an undeclared field.

## Scope and boundaries

- In scope: declaration schema, parameterized runner, declared-fields-only output, per-business scoping, risk score and verification gate.
- Out of scope: writing data; storing the config (#28).
- Dependencies/uncertainty: none. Octo's RAG has no metadata filter; title paths and an Octo table stand in until Octo adds one.

## Acceptance criteria

- [ ] Only declared fields are returned.
- [ ] Injection attempts and cross-business reads fail (tests).
- [ ] A person-lookup is refused until the caller is verified.

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #35; parent #31; depends on none.
- Primary writer claude-code / `task/WCP-0073-*`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
