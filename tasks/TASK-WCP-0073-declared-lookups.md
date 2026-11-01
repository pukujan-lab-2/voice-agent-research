# TASK-WCP-0073 — Declared Lookups

<!-- continuity:task {"acceptance":["Only declared fields are returned","Injection attempts and cross-business reads fail (tests)","A person-lookup is refused until the caller is verified"],"depends_on":[],"goal":"A business declares read-only record lookups that code runs safely with risk scores","id":"WCP-0073","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/111","next_action":"Start the leaf on its task branch","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Nothing reads an order, appointment or price from a table (#111)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

A business declares read-only record lookups that code runs safely with risk scores

## Why

Nothing reads an order, appointment or price from a table (#111)

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
- Out of scope: writing data; storing the config (#103).
- Dependencies/uncertainty: none. Octo's RAG has no metadata filter; title paths and an Octo table stand in until Octo adds one.

## Acceptance criteria

- [ ] Only declared fields are returned.
- [ ] Injection attempts and cross-business reads fail (tests).
- [ ] A person-lookup is refused until the caller is verified.

## Evidence and sources

Observed on branch `task/WCP-0073-declared-lookups` (stacked on #108 to #110):

- `npm run check` passes: 92 engine tests, 17 of them new (13 for the lookups, 4 through the desk), plus the Python and scenario steps.
- Injection: 17 hostile values (quotes, `OR 1=1`, `DROP TABLE`, `UNION SELECT`, comment tricks, a null byte, full-width quotes, `$1`) in an order-number parameter and a free-text parameter changed no row, leaked no secret and never appeared in a statement; the statement text was identical on every call. Objects, arrays, booleans, null and a 5,000-character string never reached SQL.
- Cross-business: the same order number at two businesses returns each its own row; a business id or client id supplied by the model is ignored; one business cannot call another's lookup.
- Verified versus unverified: a person lookup runs no SQL for an unverified caller (three shapes of "unverified"), a verified caller reads only their own rows, and a yes does not stand in for verification.
- Risk: under 56 runs, 56 to 90 waits for a recorded yes (the yes runs it with no model call), 91 and up is never run; the 56 and 91 limits are asserted equal to RISK_BANDS.
- Not shown: Postgres itself (tests use SQLite's parameter binding; the statements use only `$n` parameters and quoted identifiers).

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #111; parent #107; depends on none.
- Primary writer claude-code / `task/WCP-0073-*`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
