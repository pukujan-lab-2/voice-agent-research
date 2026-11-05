# TASK-WCP-0113 — Member Add Remove

<!-- continuity:task {"acceptance":["An owner or admin adds and removes a member from /business/access with Octo's one-time code (and authenticator code when enrolled)","Every add or remove try is in the access log under the admin's Octo principal, refused ones included","A plain member, or a sign-in without the write and delete scopes, gets no code and changes nobody"],"depends_on":["WCP-0112"],"goal":"A business's owner or admin adds and removes members of its Octo workspace from /business/access, confirmed with Octo's one-time code, and each change is in the access log","id":"WCP-0113","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/131","next_action":"None for this task","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"Octo's member routes now take an owner's or admin's OAuth token with a one-time code (octo-database#86), so the page's add and remove controls can work (#131 follow-up)"} -->

- Status: completed (in the pull request that adds it; the merge is the record)
- Owner: owner
- Priority: P1
- Depends on: WCP-0112 (#131, merged in #143); octo-database#86 (on Octo production through octo-database#87)

## Goal

A business's owner or admin adds and removes members of its Octo workspace from /business/access, confirmed with Octo's one-time code, and each change is in the access log

## Why

Octo's member routes now take an owner's or admin's OAuth token with a one-time code (octo-database#86), so the page's add and remove controls can work (#131 follow-up)

## Allowed files

- `copilot-engine/src/octo-signin.ts`, `copilot-engine/src/raw-access.ts`
- `demo/live-site/access-api.ts`, `demo/live-site/static/business/access/index.html`, `demo/live-site/tests/access-api.test.ts`
- `deploy/README.md`, this task record

## Human outcome

A business's owner or admin adds and removes the people who work with its calls from the same page where they give grants, without a key on the copilot's server, and the business sees each change in its access log.

## Scope and boundaries

- In scope: signing in with `read write delete` only to manage members; getting Octo's one-time code and showing it; sending it back with the authenticator code; logging each try; a note recommending an authenticator; tests.
- Out of scope: Octo's side (octo-database#86); changing the workspace owner, which Octo never allows.
- Dependencies/uncertainty: live sign-in against Octo isn't checked here, because no outside business is registered yet.

## Acceptance criteria

- [x] An owner or admin adds and removes a member from `/business/access` with Octo's one-time code (and authenticator code when enrolled).
- [x] Every add or remove try is in the access log under the admin's Octo principal, refused ones included.
- [x] A plain member, or a sign-in without the write and delete scopes, gets no code and changes nobody.

## Evidence and sources

- `npm run check` passes (see the PR).
- `demo/live-site/tests/access-api.test.ts`: a read-only sign-in is sent to sign in again; the manage sign-in asks for `read write delete`; add, a reused code, a missing member and remove each give the right answer and log entry; a plain member gets no code; the Octo client sends the code as `confirmSecret` with `mfaCode` to the right routes.
- Octo's flow: octo-database `docs/ARCHITECTURE.md` after #86.

## Related records

- Owning issue: #131 (closed by #143; this follow-up says `Refs #131`). Parent: #121.
- Primary writer: Claude Code session for the owner / branch `task/WCP-0113-member-add-remove` / as of 2026-11-05.
- PR and receipt: on #131.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
