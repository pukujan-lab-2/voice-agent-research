# TASK-WCP-0070 — Ingest Pipeline

<!-- continuity:task {"acceptance":["A fixture site loads into a business prefix with metadata on every passage and a printed count","A second run with nothing changed writes nothing; a changed page replaces only its passages; a deleted page's passages are removed","Duplicates are indexed once; two businesses never share a prefix or rows"],"depends_on":[],"goal":"Any business's site and documents load into its own Octo prefix with metadata, incrementally","id":"WCP-0070","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/32","next_action":"Start the leaf on its task branch","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A new business has no way to put its site into Octo; the IRS scripts are one-off (#32)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Any business's site and documents load into its own Octo prefix with metadata, incrementally

## Why

A new business has no way to put its site into Octo; the IRS scripts are one-off (#32)

## Allowed files

- `ingest/` (new package: pipeline, Octo store, tests)
- `package.json` (test:py script)
- `.github/workflows/ci.yml` (Python tests step)
- `docs/ingest.md`
- `tasks/TASK-WCP-0070-ingest-pipeline.md`

## Human outcome

A business with its own site can have it searched by the copilot after one command, and a re-run only touches what changed.

## Scope and boundaries

- In scope: a sitemap or start URL plus HTML, PDF and Markdown documents in; passages with url, title, section, page type, language, last modified out; a business prefix in Octo; incremental re-crawl; dedupe; indexed count.
- Out of scope: the IRS fetchers' site-specific parsing; the 880k load (#8); the page and form map (#29).
- Dependencies/uncertainty: none. Octo's RAG has no metadata filter; title paths and an Octo table stand in until Octo adds one.

## Acceptance criteria

- [ ] A fixture site loads into a business prefix with metadata on every passage and a printed count.
- [ ] A second run with nothing changed writes nothing; a changed page replaces only its passages; a deleted page's passages are removed.
- [ ] Duplicates are indexed once; two businesses never share a prefix or rows.

## Evidence and sources

Observed on branch `task/WCP-0070-ingest-pipeline` (base b9a3e7c):

- `npm run check` passes, including 31 new Python tests (`npm run test:py`) over a real local HTTP site with ETags, a sitemap and robots.txt, and an Octo stand-in on SQLite.
- Live round trip on Octo's real Postgres and search (business `ingest-smoke`, cleaned up afterwards): first run +4 passages, second run 0 writes (2 unchanged), a removed page deleted 2 passages, and a search with `titlePrefix` `ingest-smoke/en/policy/` returned the new passages. No leftover documents.
- The refactored IRS scripts read live Octo through the shared client: `irs_passages` count 145,519, `/files` list, and a jsonb upsert on a scratch table, under Python 3.9 and 3.12.
- Docling reads a real PDF made with reportlab (test run once in a separate venv with Docling installed; skipped when it is absent).
- Choices: trafilatura 2.3.1 for HTML, Docling 2.145 for PDF, httpx for conditional GETs, Crawl4AI not included (see docs/ingest.md).

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #32; parent #31; depends on none.
- Primary writer claude-code / `task/WCP-0070-*`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 18:49:07 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["ingest/, docs/ingest.md, demo/live-site/tools/irs_store.py, irs_ingest.py, package.json, knip.json, ci.yml"],"completed":["A business's own site and documents can be loaded into its own Octo prefix with one command, and a re-run only touches what changed"],"decisions":["trafilatura for HTML, Docling for PDF, httpx for conditional GETs; Crawl4AI not included"],"evidence":["npm run check passes with 31 Python tests; live Octo round trip: load, no-op re-run, delete; IRS scripts verified live on the shared client; Docling PDF read verified"],"next_action":"Open the PR for #108, then add the section, page-type and language filters (#109)","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0070","timestamp":"2026-11-01T18:49:07Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"00a3aea377f50aed3771647c54bf848224f17ca91ee64d73f22ae29f31364740","request_id":"5544550c57604ee7b3145a007b67a07a","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0070"} -->

Completed:
- A business's own site and documents can be loaded into its own Octo prefix with one command, and a re-run only touches what changed

Evidence:
- npm run check passes with 31 Python tests; live Octo round trip: load, no-op re-run, delete; IRS scripts verified live on the shared client; Docling PDF read verified

Decisions:
- trafilatura for HTML, Docling for PDF, httpx for conditional GETs; Crawl4AI not included

Changed:
- ingest/, docs/ingest.md, demo/live-site/tools/irs_store.py, irs_ingest.py, package.json, knip.json, ci.yml

Blocked/uncertain:
- none

Next:
- Open the PR for #108, then add the section, page-type and language filters (#109)

### 2026-11-01 23:17:38 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["tasks/TASK-WCP-0070-ingest-pipeline.md (merge of main and issue links)"],"completed":["The ingestion branch now sits on the moved repository's main with its issue links pointing at pukujan-lab-2 (#32), and the full check still passes"],"decisions":["none"],"evidence":["npm run check passes after merging the new main (31 Python tests, 92 engine tests, scenarios)"],"next_action":"Merge PR #52 when CI passes, then #53 to #56 in order","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0070","timestamp":"2026-11-01T23:17:38Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"4efaa041231c05ff05d7948253798626ae0ceca611cd1ea1891ec657f12ba4e7","request_id":"1013ad31f1da409c876d686c49011140","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0070"} -->

Completed:
- The ingestion branch now sits on the moved repository's main with its issue links pointing at pukujan-lab-2 (#32), and the full check still passes

Evidence:
- npm run check passes after merging the new main (31 Python tests, 92 engine tests, scenarios)

Decisions:
- none

Changed:
- tasks/TASK-WCP-0070-ingest-pipeline.md (merge of main and issue links)

Blocked/uncertain:
- none

Next:
- Merge PR #52 when CI passes, then #53 to #56 in order

### 2026-11-01 23:25:24 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none (merge of main)"],"completed":["The ingestion branch now equals main: its content (and the fuller task records) reached main through #53, so PR #52 has nothing left to merge"],"decisions":["keep PR #52 closed; issue #32 was closed with the evidence"],"evidence":["git diff origin/main HEAD is empty after merging main; npm run check passed on main plus this stack just before"],"next_action":"Merge #54, #55, #56 in order","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0070","timestamp":"2026-11-01T23:25:24Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"a078209e4259786ae4406c0f670996ea3e12dd486a8d2e156b182f3610bbc1e7","request_id":"9aa48bb8ee3f4b01a0867f2c60e2818f","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0070"} -->

Completed:
- The ingestion branch now equals main: its content (and the fuller task records) reached main through #53, so PR #52 has nothing left to merge

Evidence:
- git diff origin/main HEAD is empty after merging main; npm run check passed on main plus this stack just before

Decisions:
- keep PR #52 closed; issue #32 was closed with the evidence

Changed:
- none (merge of main)

Blocked/uncertain:
- none

Next:
- Merge #54, #55, #56 in order

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
