# TASK-WCP-0042 — Business Config

<!-- continuity:task {"acceptance":["A business's config is stored in Octo by business and loaded on demand through a bounded cache","/api/desk refuses a voice stack the business does not allow","Two businesses with the same session ids and page paths never read each other's config or snapshot (test)","A page can mount with only its business id"],"depends_on":[],"goal":"Each business's copilot config is stored in Octo and loaded on demand","id":"WCP-0042","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/103","next_action":"Merge the pull request, then start the large-site form index (#104)","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The page sends the whole config with requests, so the server can't enforce a business's allowed voice stacks and a big config rides every request (#103)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Each business's copilot config is stored in Octo and loaded on demand

## Why

The page sends the whole config with requests, so the server can't enforce a business's allowed voice stacks and a big config rides every request (#103)

## Allowed files

- `copilot-engine/src/site-config.ts`, `copilot-engine/tests/site-config.test.ts`, `copilot-engine/package.json`
- `demo/live-site/api.ts`, `widget/sdk.ts`, `widget/remote.ts`, `tools/site-config.ts`, `package.json`, `tests/state.test.ts`
- `docs/scaling-limits.md`
- `tasks/TASK-WCP-0042-business-config.md`

## Human outcome

A business's settings live on the server, so a large site sends only its id and the server can hold each call to what that business allows.

## Scope and boundaries

- In scope: the config table and loader, the endpoint, the stack check, the widget's remote mount, a put tool, tests, limits doc.
- Out of scope: an admin UI; per-form storage (#104).
- Dependencies/uncertainty: stacked on #102's branch.

## Acceptance criteria

- [ ] Config stored and loaded by business; cache bounded.
- [ ] Stack check on /api/desk.
- [ ] Isolation test between two businesses.

## Evidence and sources

Observed 2026-11-01: SiteConfigs put, get and remove against the live Octo workspace on a scratch table (dropped afterwards).

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #103; parent #100; depends on #102.
- Primary writer claude-code / `task/WCP-0042-business-config`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 18:23:32 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/site-config.ts, demo/live-site/api.ts, widget/sdk.ts, widget/remote.ts, tools/site-config.ts, tests, docs/scaling-limits.md"],"completed":["A business's pages, voice stacks and desk settings now live in Octo by business, so a large site sends only its id and the server holds each call to the stacks that business allows"],"decisions":["no new decisions"],"evidence":["npm run check passes; 4 new config tests on a real Postgres engine and 3 new API tests; SiteConfigs smoke-tested against the live Octo workspace; the widget bundle build fails in this worktree on an existing stylesheet error (::highlight) that this change does not touch"],"next_action":"Merge the pull request, then start the large-site form index (#104)","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0042","timestamp":"2026-11-01T18:23:32Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"4ad6c038ce8940471c2806268f701dae55acd1372fc316d748185bae60f57921","request_id":"a36d5cba484e4c4c9cc57db5fb42b5c6","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0042"} -->

Completed:
- A business's pages, voice stacks and desk settings now live in Octo by business, so a large site sends only its id and the server holds each call to the stacks that business allows

Evidence:
- npm run check passes; 4 new config tests on a real Postgres engine and 3 new API tests; SiteConfigs smoke-tested against the live Octo workspace; the widget bundle build fails in this worktree on an existing stylesheet error (::highlight) that this change does not touch

Decisions:
- no new decisions

Changed:
- copilot-engine/src/site-config.ts, demo/live-site/api.ts, widget/sdk.ts, widget/remote.ts, tools/site-config.ts, tests, docs/scaling-limits.md

Blocked/uncertain:
- none

Next:
- Merge the pull request, then start the large-site form index (#104)

### 2026-11-01 23:30:42 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/package.json"],"completed":["The business-config branch is up to date with main (huge-site changes) and the updated bounded-state branch, with every test script kept"],"decisions":["no new decisions"],"evidence":["npm run check passes after the merge"],"next_action":"Bring #51 (WCP-0043) up to date the same way","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0042","timestamp":"2026-11-01T23:30:42Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"3ad2623ed98b5ae52be2aa762affe7d48e3b12268b46593dfd2da66a902a36b0","request_id":"f2103cd814c942a99f977c3ea4315a65","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0042"} -->

Completed:
- The business-config branch is up to date with main (huge-site changes) and the updated bounded-state branch, with every test script kept

Evidence:
- npm run check passes after the merge

Decisions:
- no new decisions

Changed:
- copilot-engine/package.json

Blocked/uncertain:
- none

Next:
- Bring #51 (WCP-0043) up to date the same way

### 2026-11-01 23:39:48 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/package.json"],"completed":["The business-config branch is up to date with main and the updated bounded-state branch"],"decisions":["no new decisions"],"evidence":["npm run check passes after the merge"],"next_action":"Bring #51 up to date","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0042","timestamp":"2026-11-01T23:39:48Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"aa63efd0292b7d23fcfb89d3540756978d7adde33b86949634cb3fa1dfad3087","request_id":"557272150cce4f668334546de161f9c9","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0042"} -->

Completed:
- The business-config branch is up to date with main and the updated bounded-state branch

Evidence:
- npm run check passes after the merge

Decisions:
- no new decisions

Changed:
- copilot-engine/package.json

Blocked/uncertain:
- none

Next:
- Bring #51 up to date

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
