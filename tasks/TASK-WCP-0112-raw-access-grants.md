# TASK-WCP-0112 — Raw Access Grants

<!-- continuity:task {"acceptance":["A grant names who, which calls and until when; the business's owner or an admin gives and revokes it from /business/access","Every read of a raw call writes an entry to that business's access log under the reader's Octo identity, emergency reads included","A plain-code test: every open of a raw call shows in the log, and an expired or revoked grant opens nothing"],"depends_on":["WCP-0108"],"goal":"Raw calls open only for a signed-in Octo member of the business's workspace who holds a grant, with every read logged under their Octo identity","id":"WCP-0112","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/131","next_action":"open the pull request with Closes #131, confirm CI is green and arm auto-merge","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Decision 0021 settles that raw calls open only by a grant the business gives and revokes, every read is logged where the business sees it, and an emergency path is logged the same way (#131)"} -->

- Status: active
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
- Primary writer: Claude Code session for the owner / branch `task/WCP-0112-raw-access-grants` / as of 2026-11-05 open.
- PR and receipt: on #131.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
