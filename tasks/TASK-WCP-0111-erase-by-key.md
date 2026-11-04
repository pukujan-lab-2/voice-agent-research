# TASK-WCP-0111 — Erase By Key

<!-- continuity:task {"acceptance":["One call, one caller, or one business can be deleted by destroying its key in OpenBao","The rows are also removed from Octo where they live","A plain-code test: after deletion, the record and a backup copy taken before it no longer decrypt"],"depends_on":["WCP-0108"],"goal":"Delete one call, one caller or one business by destroying its key in OpenBao, and remove its rows from Octo","id":"WCP-0111","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/132","next_action":"open the pull request with Closes #132, confirm CI is green and arm auto-merge","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A caller who asks to be forgotten or a business that leaves needs every copy gone, backups included; deleting rows does not reach backups (decision 0021, #132)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: WCP-0108 (#128, merged)

## Goal

Delete one call, one caller or one business by destroying its key in OpenBao, and remove its rows from Octo

## Why

A caller who asks to be forgotten or a business that leaves needs every copy gone, backups included (decision 0021)

## Allowed files

- `copilot-engine/src/call-vault.ts`, `call-records.ts`, `call-audio.ts`, `call-callers.ts` (new)
- `copilot-engine/tests/call-vault.test.ts`, `fake-transit.ts`
- `demo/live-site/api.ts`, `demo/live-site/tools/erase.ts` (new), `demo/live-site/tests/own-workspace.test.ts`
- `deploy/README.md`, this task record

## Human outcome

A caller who asks to be forgotten, or a business that leaves, can be erased for good, including from backups: destroying a key in OpenBao makes every copy of their calls unreadable, and their rows and files go from Octo.

## Scope and boundaries

- In scope: a key per call in OpenBao beside the business key; erasing one call, one caller (every call linked to them) or one business; removing rows and files from Octo; the retention sweep destroying the key of each call it empties; an operator tool; tests.
- Out of scope: whether key destruction is erasure under each region's law (counsel, #132); erasing from the business's own page, which needs grants (#131); linking a live caller to a call when they are verified, which waits on verified callers (decision 0021 settlement 6).
- Dependencies/uncertainty: OpenBao's own snapshots keep a destroyed key until they age out.

## Acceptance criteria

- [x] One call, one caller, or one business can be deleted by destroying its key in OpenBao.
- [x] The rows are also removed from Octo where they live.
- [x] A plain-code test: after deletion, the record and a backup copy taken before it no longer decrypt.

## Evidence and sources

- `npm run check` passes (see the PR).
- `copilot-engine/tests/call-vault.test.ts`: erasing a call or a business makes a copy taken before unopenable; other calls and businesses still open; records from before #132 still open.
- `demo/live-site/tests/own-workspace.test.ts`: erasing a call, a caller and a business against a fake Octo, then putting the pre-erasure backup back: nothing of it opens.
- Live, 2026-11-04, in the VPS `copilot-web` container against OpenBao with the existing `copilot` policy: a backup of an erased call is refused ("encryption key not found"), a sibling call still opens, and after erasing the business its other call's backup is refused too. The check's keys were destroyed afterwards, `biz-live-check` included.

## Related records

- Leaf: #132. Parent: #121. Depends on: #128 (merged as #136).
- Primary writer: Claude Code session for the owner / branch `task/WCP-0111-erase-by-key` / as of 2026-11-04 open.
- PR and receipt: on #132.

## Checkpoint log

No checkpoints yet.

### 2026-11-04 23:42:41 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/call-vault.ts, call-records.ts, call-audio.ts, call-callers.ts, demo/live-site/api.ts, demo/live-site/tools/erase.ts, deploy/README.md, tests"],"completed":["A call, a caller or a business can now be erased by destroying a key in OpenBao: each call's data key needs the business key and the call's own key, and the rows and files are removed from Octo afterwards (#132)"],"decisions":["Callers are erased by destroying the key of each call linked to them, because a caller is usually identified after a call's first words are locked"],"evidence":["npm run check exit 0, gate ok; tests show a backup taken before erasing no longer opens; a live check against the VPS OpenBao refused an erased call's copy and still opened the other call"],"next_action":"open the pull request with Closes #132, confirm CI is green and arm auto-merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0111","timestamp":"2026-11-04T23:42:41Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"f7fe4f54efcf848703cae4620813e542a36aecd5434275187b136065908c9f40","request_id":"f5734795c0d94971b26e50ab32eea1dc","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0111"} -->

Completed:
- A call, a caller or a business can now be erased by destroying a key in OpenBao: each call's data key needs the business key and the call's own key, and the rows and files are removed from Octo afterwards (#132)

Evidence:
- npm run check exit 0, gate ok; tests show a backup taken before erasing no longer opens; a live check against the VPS OpenBao refused an erased call's copy and still opened the other call

Decisions:
- Callers are erased by destroying the key of each call linked to them, because a caller is usually identified after a call's first words are locked

Changed:
- copilot-engine/src/call-vault.ts, call-records.ts, call-audio.ts, call-callers.ts, demo/live-site/api.ts, demo/live-site/tools/erase.ts, deploy/README.md, tests

Blocked/uncertain:
- none

Next:
- open the pull request with Closes #132, confirm CI is green and arm auto-merge

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
