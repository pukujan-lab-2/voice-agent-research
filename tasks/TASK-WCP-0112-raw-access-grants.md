# TASK-WCP-0112 — Raw Access Grants

<!-- continuity:task {"acceptance":["A grant names who, which calls and until when; the business's owner or an admin gives and revokes it from /business/access","Every read of a raw call writes an entry to that business's access log under the reader's Octo identity, emergency reads included","A plain-code test: every open of a raw call shows in the log, and an expired or revoked grant opens nothing"],"depends_on":["WCP-0108"],"goal":"Raw calls open only for a signed-in Octo member of the business's workspace who holds a grant, with every read logged under their Octo identity","id":"WCP-0112","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/131","next_action":"None for this task","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"Decision 0021 settles that raw calls open only by a grant the business gives and revokes, every read is logged where the business sees it, and an emergency path is logged the same way (#131)"} -->

- Status: completed (merged in #143 as 1d9cb3a)
- Owner: owner
- Priority: P1
- Depends on: WCP-0108 (#128, merged); octo-database#82 (merged as octo-database#83)

## Goal

Raw calls open only for a signed-in Octo member of the business's workspace who holds a grant, with every read logged under their Octo identity

## Why

Decision 0021 settles that raw calls open only by a grant the business gives and revokes, every read is logged where the business sees it, and an emergency path is logged the same way (#131)

## Allowed files

- `copilot-engine/src/raw-access.ts`, `octo-signin.ts` (new), `copilot-engine/tests/raw-access.test.ts` (new), `copilot-engine/package.json`
- `demo/live-site/access-api.ts` (new), `api.ts`, `server.ts`, `static/business/access/index.html` (new), `tests/access-api.test.ts` (new)
- `deploy/README.md`, this task record

## Human outcome

A business can see and limit who reads its callers' words: its own people sign in with Octo, open a call only with a grant the business gave, and every open (or refused try, or emergency read) shows in a log the business reads.

## Scope and boundaries

- In scope: Octo OAuth sign-in for the business's people; the live membership and role check before any unlock; grants (who, which calls, until when, why) given and revoked by the owner or an admin; the access log under the Octo principal, written before the unlock; the owner's emergency path with a flagged reason; the `/business/access` page with members, grants and the log; tests.
- Out of scope: staff sign-in beyond Octo's (phase 6); adding and removing members from the copilot's page. Octo's member routes (octo-database#83) accept only a person's own Octo session or an owner agent key, not an OAuth token, and Octo has no members screen yet.
- Dependencies/uncertainty: octo-database#83 is merged but not yet on Octo's `production`, so live sign-in against Octo isn't checked; no outside business is registered yet.

## Acceptance criteria

- [x] A grant names who, which calls and until when; the business's owner or an admin gives and revokes it from `/business/access`.
- [x] Every read of a raw call writes an entry to that business's access log under the reader's Octo identity, emergency reads included.
- [x] A plain-code test: every open of a raw call shows in the log, and an expired or revoked grant opens nothing.

## Evidence and sources

- `npm run check` passes (see the PR).
- `copilot-engine/tests/raw-access.test.ts` (real Postgres via PGlite): only a live grant opens a call and each try is logged; revoked, expired and another business's grants open nothing; only the owner or an admin gives grants; the owner's emergency read is flagged; nothing opens if the log entry can't be written.
- `demo/live-site/tests/access-api.test.ts`: the sign-in redirect flow, a grant then an open, someone removed in Octo refused at once, another workspace never signed in, the `x-access` header and the host check.
- Octo's OAuth and `/api/me` shape: octo-database `docs/ARCHITECTURE.md` and `src/routes/me.ts` at main after #83.

## Related records

- Leaf: #131. Parent: #121. Depends on: #128 (merged as #136), octo-database#82.
- Primary writer: Claude Code session for the owner / branch `task/WCP-0112-raw-access-grants` / as of 2026-11-05 merged.
- PR and receipt: on #131.

## Checkpoint log

No checkpoints yet.

### 2026-11-05 00:35:59 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/raw-access.ts, octo-signin.ts, demo/live-site/access-api.ts, api.ts, server.ts, static/business/access/index.html, deploy/README.md, tests"],"completed":["A business's people sign in with Octo at /business/access; the owner or an admin gives and revokes grants; every open of a raw call is logged under the reader's Octo principal before it unlocks, and the owner has a flagged emergency path (#131)"],"decisions":["Adding and removing members stays in Octo: octo-database#83's add and remove routes refuse OAuth tokens, so the page lists members only"],"evidence":["npm run check exit 0; raw-access.test.ts shows revoked, expired and other-business grants open nothing and every try is logged; access-api.test.ts shows a member removed in Octo refused at once"],"next_action":"open the pull request with Closes #131, confirm CI is green and arm auto-merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0112","timestamp":"2026-11-05T00:35:59Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"f313ae0ee54adec16478c0b132d6edeb5ae03a485be73779721a31d7e5ecb454","request_id":"64c3f9b9fd6e40ca8c697ec8b5a3643f","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0112"} -->

Completed:
- A business's people sign in with Octo at /business/access; the owner or an admin gives and revokes grants; every open of a raw call is logged under the reader's Octo principal before it unlocks, and the owner has a flagged emergency path (#131)

Evidence:
- npm run check exit 0; raw-access.test.ts shows revoked, expired and other-business grants open nothing and every try is logged; access-api.test.ts shows a member removed in Octo refused at once

Decisions:
- Adding and removing members stays in Octo: octo-database#83's add and remove routes refuse OAuth tokens, so the page lists members only

Changed:
- copilot-engine/src/raw-access.ts, octo-signin.ts, demo/live-site/access-api.ts, api.ts, server.ts, static/business/access/index.html, deploy/README.md, tests

Blocked/uncertain:
- none

Next:
- open the pull request with Closes #131, confirm CI is green and arm auto-merge

### 2026-11-05 00:38:23 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["demo/live-site/static/business/access/index.html, deploy/README.md"],"completed":["The access page shows adding and removing members as coming soon, switched off, until Octo lets an owner's or admin's OAuth token pass the member routes with a one-time code"],"decisions":["Owner chose option (b) for add and remove: an Octo change for OAuth tokens with a one-time code; no OCTO_AGENT_KEY on the copilot server"],"evidence":["no external evidence recorded"],"next_action":"let PR 143 merge, then wire add and remove to Octo's one-time-code flow when it exists","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0112","timestamp":"2026-11-05T00:38:23Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"35a58dc13bb1cad543a4d402fea33d4ee267755ffe6c9c8c54b092d448017f73","request_id":"7155958716da46dc95f68c0b9c14df6a","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0112"} -->

Completed:
- The access page shows adding and removing members as coming soon, switched off, until Octo lets an owner's or admin's OAuth token pass the member routes with a one-time code

Evidence:
- no external evidence recorded

Decisions:
- Owner chose option (b) for add and remove: an Octo change for OAuth tokens with a one-time code; no OCTO_AGENT_KEY on the copilot server

Changed:
- demo/live-site/static/business/access/index.html, deploy/README.md

Blocked/uncertain:
- none

Next:
- let PR 143 merge, then wire add and remove to Octo's one-time-code flow when it exists

### 2026-11-05 00:44:23 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["tasks/TASK-WCP-0112-raw-access-grants.md"],"completed":["WCP-0112 marked completed after #143 merged and closed #131"],"decisions":["no new decisions"],"evidence":["no external evidence recorded"],"next_action":"None for this task","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0112","timestamp":"2026-11-05T00:44:23Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"5cdd82178e422591fd5d435c8602c2619995f16c2c3204b88c59bf33db6f32eb","request_id":"3be4851c7521447c922eb3570dc80bf6","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0112"} -->

Completed:
- WCP-0112 marked completed after #143 merged and closed #131

Evidence:
- no external evidence recorded

Decisions:
- no new decisions

Changed:
- tasks/TASK-WCP-0112-raw-access-grants.md

Blocked/uncertain:
- none

Next:
- None for this task

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
