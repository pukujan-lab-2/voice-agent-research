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
- `copilot-engine/src/desk.ts` (a small hook: lookup tools, the caller, the yes for a high-risk lookup)
- `copilot-engine/tests/lookups-desk.test.ts`
- `copilot-engine/package.json` (test script)
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

- Leaf #35; parent #31; depends on none.
- Primary writer claude-code / `task/WCP-0073-*`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 18:52:49 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/lookups.ts, desk.ts, tests/lookups*.test.ts, docs/lookups.md"],"completed":["A business can declare read-only record lookups that code runs with bound parameters, declared fields only, its own rows, and a verified caller for anything about a person"],"decisions":["risk under 56 runs, 56 to 90 needs a recorded yes, 91 and up goes to a person; a person lookup is never below 45"],"evidence":["npm run check passes; 17 new tests: injection (17 hostile values), cross-business, verified versus unverified, risk gating"],"next_action":"Open the PR for #111, then build the huge-site evals (#112)","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0073","timestamp":"2026-11-01T18:52:49Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"fdb19a3abb23cd00a1c7c38f2cdf35948dbbf3c29877ec152264bf22a00d4170","request_id":"3d193f457ad64e6e9f98693eec971d2d","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0073"} -->

Completed:
- A business can declare read-only record lookups that code runs with bound parameters, declared fields only, its own rows, and a verified caller for anything about a person

Evidence:
- npm run check passes; 17 new tests: injection (17 hostile values), cross-business, verified versus unverified, risk gating

Decisions:
- risk under 56 runs, 56 to 90 needs a recorded yes, 91 and up goes to a person; a person lookup is never below 45

Changed:
- copilot-engine/src/lookups.ts, desk.ts, tests/lookups*.test.ts, docs/lookups.md

Blocked/uncertain:
- none

Next:
- Open the PR for #111, then build the huge-site evals (#112)

### 2026-11-01 23:19:14 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["tasks/TASK-WCP-0073-declared-lookups.md, docs/lookups.md"],"completed":["The declared-lookups branch sits on the moved repository's main"],"decisions":["none"],"evidence":["npm run check passes on the stack after merging the moved repository's main; issue links point at pukujan-lab-2"],"next_action":"Merge PR #55 after #54","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0073","timestamp":"2026-11-01T23:19:14Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"bb9bccb664f80b8f2b78567064c40905f60060b6490da4bb6ec3d49b52d72830","request_id":"d8823c29e3e3401bb17622546503437c","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0073"} -->

Completed:
- The declared-lookups branch sits on the moved repository's main

Evidence:
- npm run check passes on the stack after merging the moved repository's main; issue links point at pukujan-lab-2

Decisions:
- none

Changed:
- tasks/TASK-WCP-0073-declared-lookups.md, docs/lookups.md

Blocked/uncertain:
- none

Next:
- Merge PR #55 after #54

### 2026-11-01 23:19:35 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["tasks/TASK-WCP-0073-*.md"],"completed":["Carried the earlier branch's final state into this one so the stacked pull requests merge cleanly in order"],"decisions":["none"],"evidence":["merge of task/WCP-0072-search-site-tool; npm run check passed on the stack top just before"],"next_action":"Merge PR #55 after #54","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0073","timestamp":"2026-11-01T23:19:35Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"5caaac65a7bcf6cb8266e174d210384d3b9656546dce5325e253f34753085314","request_id":"e62f9b608a7048e295cd99b5454a39f4","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0073"} -->

Completed:
- Carried the earlier branch's final state into this one so the stacked pull requests merge cleanly in order

Evidence:
- merge of task/WCP-0072-search-site-tool; npm run check passed on the stack top just before

Decisions:
- none

Changed:
- tasks/TASK-WCP-0073-*.md

Blocked/uncertain:
- none

Next:
- Merge PR #55 after #54

### 2026-11-01 23:23:50 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["tasks/, copilot-engine/package.json"],"completed":["Merged the moved repository's main (which now holds the first two PRs' content) into this branch so it merges cleanly"],"decisions":["none"],"evidence":["npm run check passes after the merge: 92 engine tests, 16 eval tests, 31 Python tests, scenarios"],"next_action":"Merge PR #55 after #54","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0073","timestamp":"2026-11-01T23:23:50Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"aac6ab38df26554813d1020bb882eb2a1f9da4290a4b8711778a6f2dbeb43ec0","request_id":"da8eb1db3fe74a2481dd5c328587d599","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0073"} -->

Completed:
- Merged the moved repository's main (which now holds the first two PRs' content) into this branch so it merges cleanly

Evidence:
- npm run check passes after the merge: 92 engine tests, 16 eval tests, 31 Python tests, scenarios

Decisions:
- none

Changed:
- tasks/, copilot-engine/package.json

Blocked/uncertain:
- none

Next:
- Merge PR #55 after #54

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
