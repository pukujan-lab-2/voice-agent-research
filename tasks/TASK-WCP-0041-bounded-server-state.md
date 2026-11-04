# TASK-WCP-0041 — Bounded Server State

<!-- continuity:task {"acceptance":["Verification locks, rate limits and resume snapshots sit behind the Store interface with a time limit and a hard size cap","An Octo-backed store holds locks and snapshots, so a restart or a second instance loses nothing","Tests run the Octo store on a real Postgres engine"],"depends_on":[],"goal":"The backend's call, rate-limit and cache state is bounded, and resume snapshots live in Octo","id":"WCP-0041","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/102","next_action":"None for this task","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"Caller verification and rate limits live in process memory: a restart loses them, a second instance can't see them, and nothing caps them (#102)"} -->

- Status: completed (merged in #49 as c8671af)
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

The backend's call, rate-limit and cache state is bounded, and resume snapshots live in Octo

## Why

Caller verification and rate limits live in process memory: a restart loses them, a second instance can't see them, and nothing caps them (#102)

## Allowed files

- `copilot-engine/src/memory.ts`, `octo-store.ts`, `desk.ts` (snapshot key)
- `copilot-engine/tests/stores.test.ts`, `pg-sql.ts`; `copilot-engine/package.json`
- `demo/live-site/api.ts`, `practice-api.ts`, `server.ts`
- `demo/live-site/tests/state.test.ts`, `state-load.ts`; `package.json`
- `docs/scaling-limits.md`
- `tasks/TASK-WCP-0041-bounded-server-state.md`

## Human outcome

Caller verification, rate limits and resume snapshots survive a restart, are shared by a second instance where they must be, and can't grow without a bound.

## Scope and boundaries

- In scope: the stores, the Octo store, moving `calls`, `fails` and `hits` onto them, a session endpoint, tests, limits doc.
- Out of scope: wiring resume into the call UI (#57), per-business config (#103).
- Dependencies/uncertainty: stacked on #101's branch only for the shared limits doc. Octo has no key-value surface; proposal filed as octo-database#457.

## Acceptance criteria

- [ ] Size cap and time limit hold under 10,000 inserts.
- [ ] Counters and locks survive a second instance and a restart (tests).
- [ ] Octo store tested on real SQL; smoke-tested once against the live Octo workspace.

## Evidence and sources

Observed 2026-11-01: OctoStore set, get, counter, expiry, sweep and delete against the live chatbots workspace (scratch table, dropped afterwards), about 67 ms per read. State memory table in docs/scaling-limits.md.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #102; parent #100; depends on none (branch stacked on #101's PR #105).
- Primary writer claude-code / `task/WCP-0041-bounded-state`; source issue open as of 2026-11-01.
- Octo proposal: octo-database#457.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 18:18:42 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/memory.ts, octo-store.ts, demo/live-site/api.ts, tests, docs/scaling-limits.md"],"completed":["A restart or a second instance no longer loses caller-verification locks or resume snapshots, and no per-call state grows without a cap"],"decisions":["no new decisions; rate limits stay per instance because an Octo round trip is slower than a desk turn can spare"],"evidence":["npm run check passes; 14 new tests, the Octo store on a real Postgres engine; OctoStore smoke-tested against the live workspace (about 67 ms a read)"],"next_action":"Merge the pull request, then start the per-business config leaf (#103)","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0041","timestamp":"2026-11-01T18:18:42Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"ff52c12b0bf636c63c5fa91fcef1b2387d7688891a828a120be5693d396d9c15","request_id":"b88cd5fe5db24f6d8b2bbe2ed99cf555","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0041"} -->

Completed:
- A restart or a second instance no longer loses caller-verification locks or resume snapshots, and no per-call state grows without a cap

Evidence:
- npm run check passes; 14 new tests, the Octo store on a real Postgres engine; OctoStore smoke-tested against the live workspace (about 67 ms a read)

Decisions:
- no new decisions; rate limits stay per instance because an Octo round trip is slower than a desk turn can spare

Changed:
- copilot-engine/src/memory.ts, octo-store.ts, demo/live-site/api.ts, tests, docs/scaling-limits.md

Blocked/uncertain:
- none

Next:
- Merge the pull request, then start the per-business config leaf (#103)

### 2026-11-01 23:29:36 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/desk.ts, copilot-engine/package.json"],"completed":["The bounded-state branch is up to date with main (huge-site changes) and the updated prompt-budget branch, both sides kept in the desk constructor and test scripts"],"decisions":["no new decisions"],"evidence":["npm run check passes after the merge"],"next_action":"Bring #50 (WCP-0042) and #51 (WCP-0043) up to date the same way","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0041","timestamp":"2026-11-01T23:29:36Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"8f23cfd09a617dcb0479baec0c2cf6cb27f29aa0f1d5ded0d06afb4ad52f15c3","request_id":"63133819f2a34306bb8b904b10fcc346","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0041"} -->

Completed:
- The bounded-state branch is up to date with main (huge-site changes) and the updated prompt-budget branch, both sides kept in the desk constructor and test scripts

Evidence:
- npm run check passes after the merge

Decisions:
- no new decisions

Changed:
- copilot-engine/src/desk.ts, copilot-engine/package.json

Blocked/uncertain:
- none

Next:
- Bring #50 (WCP-0042) and #51 (WCP-0043) up to date the same way

### 2026-11-01 23:38:39 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/desk.ts, copilot-engine/package.json, docs/scaling-limits.md"],"completed":["The bounded-state branch is up to date with main after the prompt-budget pull request merged; the desk's business option and scoped snapshot key are re-applied on main's desk"],"decisions":["no new decisions"],"evidence":["npm run check passes after the merge"],"next_action":"Bring #50 and #51 up to date in order","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0041","timestamp":"2026-11-01T23:38:39Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"d9723ab681b468111dcbe4e606059bc25c858875f58755cb661e93003d935668","request_id":"5844bf440441408c93127c9b84a160dd","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0041"} -->

Completed:
- The bounded-state branch is up to date with main after the prompt-budget pull request merged; the desk's business option and scoped snapshot key are re-applied on main's desk

Evidence:
- npm run check passes after the merge

Decisions:
- no new decisions

Changed:
- copilot-engine/src/desk.ts, copilot-engine/package.json, docs/scaling-limits.md

Blocked/uncertain:
- none

Next:
- Bring #50 and #51 up to date in order

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
