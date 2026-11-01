# TASK-WCP-0070 — Ingest Pipeline

<!-- continuity:task {"acceptance":["A fixture site loads into a business prefix with metadata on every passage and a printed count","A second run with nothing changed writes nothing; a changed page replaces only its passages; a deleted page's passages are removed","Duplicates are indexed once; two businesses never share a prefix or rows"],"depends_on":[],"goal":"Any business's site and documents load into its own Octo prefix with metadata, incrementally","id":"WCP-0070","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/108","next_action":"Start the leaf on its task branch","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A new business has no way to put its site into Octo; the IRS scripts are one-off (#108)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Any business's site and documents load into its own Octo prefix with metadata, incrementally

## Why

A new business has no way to put its site into Octo; the IRS scripts are one-off (#108)

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
- Out of scope: the IRS fetchers' site-specific parsing; the 880k load (#18); the page and form map (#104).
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

- Leaf #108; parent #107; depends on none.
- Primary writer claude-code / `task/WCP-0070-*`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
