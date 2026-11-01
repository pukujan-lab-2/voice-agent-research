# TASK-WCP-0007 — Tax demo link

<!-- continuity:task {"acceptance":["The Try it live section has a Brindlewick Tax & Accounting card linking to /tax","The section text counts six companies","npm run check passes"],"depends_on":[],"goal":"The demo home page links the Brindlewick tax site","id":"WCP-0007","next_action":"Open the pull request for #44 and let auto-merge wait for gates","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Visitors couldn't find the tax demo from the home page"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

The demo home page links the Brindlewick tax site.

## Why

Visitors couldn't find the tax demo from the home page (owner, 2026-11-01).

## Allowed files

- `demo/live-site/app/src/pages/Index.tsx`
- `copilot-engine/ledger.jsonl` (rows `npm run check` appends)
- this task file

## Human outcome

The tax demo is one click from the home page.

## Scope and boundaries

- In scope: one card in the demo list and the company count.
- Out of scope: the tax site itself.
- Dependencies/uncertainty: none.

## Acceptance criteria

- [x] "Try it live" has a Brindlewick Tax & Accounting card linking to `/tax`.
- [x] The section text says six companies.
- [x] `npm run check` passes.
- [ ] The pull request passes required CI and merges.

## Evidence and sources

- `Index.tsx` on `main` at `2639b17` listed five demos, none for `/tax`.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #44; parent none; depends on none. Related: #42.
- Primary writer / branch / source issue revision / as-of status: claude-code / `feat/44-tax-demo-link` / issue #44 as of 2026-11-01 / open.
- Related PR/CI evidence and push receipt (request ID / SHA): the receipt follows the checkpoint push.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 02:35:17 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["demo/live-site/app/src/pages/Index.tsx","copilot-engine/ledger.jsonl"],"completed":["Added a Brindlewick Tax & Accounting card linking to /tax in the demo home page's Try it live list, and changed the count to six companies"],"decisions":["no new decisions"],"evidence":["npm run check passes: lint, typecheck, knip; npm test 33/33; scenarios 8/8"],"next_action":"Open the pull request for #44 and let auto-merge wait for gates","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0007","timestamp":"2026-11-01T02:35:17Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"72bc133ed34f72dbb6f6f000048282bf0fe7b91f6d824fec30fcad59f15b4d7a","request_id":"bc83c08015334f6699d9a12b5232a482","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0007"} -->

Completed:
- Added a Brindlewick Tax & Accounting card linking to /tax in the demo home page's Try it live list, and changed the count to six companies

Evidence:
- npm run check passes: lint, typecheck, knip; npm test 33/33; scenarios 8/8

Decisions:
- no new decisions

Changed:
- demo/live-site/app/src/pages/Index.tsx
- copilot-engine/ledger.jsonl

Blocked/uncertain:
- none

Next:
- Open the pull request for #44 and let auto-merge wait for gates
