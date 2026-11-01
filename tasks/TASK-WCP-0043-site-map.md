# TASK-WCP-0043 — Site Map

<!-- continuity:task {"acceptance":["Each form and page of a business is indexed in Octo by business","A lookup by the current page or the visitor's words returns the right form and loads only that flow","A synthetic site of 200 forms: 30 queries find the right form, one flow loaded each, nothing from another business"],"depends_on":[],"goal":"A large site's pages and forms are found by search, and only the form needed is loaded","id":"WCP-0043","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/104","next_action":"Merge the pull requests in order (#105, #128, #130, this one), push main to production and post the before-and-after table on #100","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A site with hundreds of forms cannot keep every flow in memory, and the widget matches requests against the whole page list (#104)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

A large site's pages and forms are found by search, and only the form needed is loaded

## Why

A site with hundreds of forms cannot keep every flow in memory, and the widget matches requests against the whole page list (#104)

## Allowed files

- `copilot-engine/src/site-map.ts`, `copilot-engine/tests/site-map.test.ts`, `copilot-engine/package.json`
- `demo/live-site/api.ts`, `tools/site-config.ts`, `tests/state.test.ts`
- `docs/scaling-limits.md`, `docs/decisions/0017-*.md`, `docs/decisions/README.md`, `PROJECT.md`
- `tasks/TASK-WCP-0043-site-map.md`

## Human outcome

A site with hundreds of forms costs the server no more memory than one with ten, and the copilot finds the right form from the page or from what the visitor asked.

## Scope and boundaries

- In scope: the site-map table and search, the lookup endpoint, an index tool, tests, limits doc, decision 0017, PROJECT status.
- Out of scope: ingest and retrieval filters (the huge-sites session, #107); wiring the voice agent to the map; reading forms from live pages (page.ts does that).
- Dependencies/uncertainty: stacked on #103's branch. Search is Postgres full-text search, which has no synonyms of its own.

## Acceptance criteria

- [ ] 200-form site: right form found for 30 requests; one flow loaded per lookup.
- [ ] Business isolation tested.
- [ ] Limits in docs/scaling-limits.md and PROJECT.md; decision 0017.

## Evidence and sources

Observed 2026-11-01: SiteMap put, find, forPage and load against the live Octo workspace on a scratch table (dropped afterwards); generated tsvector column and GIN index work on Octo's Postgres.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #104; parent #100; depends on #103.
- Primary writer claude-code / `task/WCP-0043-site-map`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 18:27:43 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/site-map.ts, demo/live-site/api.ts, tools/site-config.ts, docs/scaling-limits.md, docs/decisions/0017, PROJECT.md"],"completed":["A site with 200 forms no longer needs every flow in memory: the right form is found by the page or the visitor's words and only that flow is loaded"],"decisions":["decision 0017: the model sees a window of the form; state lives in capped stores"],"evidence":["npm run check passes; 6 new site-map tests on a real Postgres engine (200 forms, 30 requests all right) and one API test; SiteMap smoke-tested on the live Octo workspace"],"next_action":"Merge #105, #128, #130 and this pull request in order, push main to production, post the before-and-after table on #100","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0043","timestamp":"2026-11-01T18:27:43Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"96ec54c0283de33409c94881468a79c4b4b473455fccefed316372080fe01b19","request_id":"ba67a2d579e14a7bab15958e4d265a73","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0043"} -->

Completed:
- A site with 200 forms no longer needs every flow in memory: the right form is found by the page or the visitor's words and only that flow is loaded

Evidence:
- npm run check passes; 6 new site-map tests on a real Postgres engine (200 forms, 30 requests all right) and one API test; SiteMap smoke-tested on the live Octo workspace

Decisions:
- decision 0017: the model sees a window of the form; state lives in capped stores

Changed:
- copilot-engine/src/site-map.ts, demo/live-site/api.ts, tools/site-config.ts, docs/scaling-limits.md, docs/decisions/0017, PROJECT.md

Blocked/uncertain:
- none

Next:
- Merge #105, #128, #130 and this pull request in order, push main to production, post the before-and-after table on #100

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
