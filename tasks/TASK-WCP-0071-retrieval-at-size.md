# TASK-WCP-0071 — Retrieval At Size

<!-- continuity:task {"acceptance":["A filter never returns a passage outside it (tests)","recall@5/10, MRR and latency reported at each size for the synthetic site and the IRS library","What is slow is filed in the Octo repo with measurements"],"depends_on":["WCP-0070"],"goal":"Search narrows by section, page type and language and holds up at 200,000 passages, with measured figures","id":"WCP-0071","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/33","next_action":"Start the leaf on its task branch","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Search has no filters and nobody has measured it beyond 133,000 passages (#33)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: WCP-0070

## Goal

Search narrows by section, page type and language and holds up at 200,000 passages, with measured figures

## Why

Search has no filters and nobody has measured it beyond 133,000 passages (#33)

## Allowed files

- `copilot-engine/src/guide.ts` (OctoRetriever filters)
- `copilot-engine/tests/` (filter tests)
- `eval/retrieval.py, eval/lib/, eval/size/` (synthetic site and size test)
- `eval/out/synthetic-*`, `eval/out/irs-live` (measured outputs)
- `docs/retrieval-limits.md` (written with the last increment, #112, so it can also carry the tool-call limits)
- `tasks/TASK-WCP-0071-retrieval-at-size.md`

## Human outcome

A visitor's question can be narrowed to a section, page type or language, and the owner knows how fast and how accurate search is at each size.

## Scope and boundaries

- In scope: filters by section, page type and language; a synthetic site generator; recall@5/10, MRR and latency at 10k, 50k and 200k passages and on the IRS library; Octo issues for what is slow.
- Out of scope: changing Octo itself; a local copy of the data.
- Dependencies/uncertainty: builds on WCP-0070. Octo's RAG has no metadata filter; title paths and an Octo table stand in until Octo adds one.

## Acceptance criteria

- [ ] A filter never returns a passage outside it (tests).
- [ ] recall@5/10, MRR and latency reported at each size for the synthetic site and the IRS library.
- [ ] What is slow is filed in the Octo repo with measurements.

## Evidence and sources
Observed on branch `task/WCP-0071-retrieval-at-size` (base: #108's branch):

- 10 new tests (`copilot-engine/tests/site-search.test.ts`): language and page type narrow by title prefix, a section narrows through the ids under it, a page type without a language is checked on the results, a filter never returns a passage outside it (every combination), another business's passages never come back even when Octo ignores the prefix, odd filter values are dropped or bound as parameters.
- Size test (`eval/size/bench.py`): Octo's own `match_chunks_hybrid` on a scratch pgvector database, synthetic site, scored with ranx through `eval/retrieval.py`. recall@5, recall@10 and MRR were 1.0, 1.0, 1.0 at 10,000 passages, 1.0, 1.0, 0.998 at 50,000 and 0.997, 0.997, 0.993 at 200,000 (all queries, all filters). Latency at 200,000: 0.24 s unfiltered, 2.1 s for a whole-business prefix, 0.38 s for language plus page type, 0.27 s by section.
- IRS library, live Octo, reranker on, 80 gold-labelled casual questions: recall@5 0.762, recall@10 0.838, MRR 0.70; search 1.5 s p50, 2.4 s p90 at 145,519 indexed passages.
- Slow part named upstream: pukujan-lab-2/octo-database#38 (comment with the 200,000-chunk breakdown) and #48 (metadata filters and batch ingest, filed). No local copy of any data.
- 1,000,000 passages was not measured (the 2 GB scratch VM cannot hold it); the doc says so.
## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #33; parent #31; depends on WCP-0070.
- Primary writer claude-code / `task/WCP-0071-*`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 19:04:43 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/site-search.ts, guide.ts, eval/size/, eval/out/synthetic-*, eval/out/irs-live"],"completed":["A search can be narrowed to a section, page type and language, and retrieval is measured at 10,000, 50,000 and 200,000 passages and on the live IRS library"],"decisions":["metadata lives in the title prefix and a workspace table until Octo has a metadata filter"],"evidence":["recall@10 0.997 to 1.0 on the synthetic site at every size; 200,000 passages: 0.24 s unfiltered, 2.1 s whole-business prefix; IRS live 1.5 s p50, recall@10 0.838; slow part filed on octo-database#38 and #48"],"next_action":"Open the PR for #109","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0071","timestamp":"2026-11-01T19:04:43Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"9fe2962c47705da8472d29ddfd05edc36e5c5e3a71506fc6148605e976fcfdc6","request_id":"c4fec9268dee499c8a69ed4a11be753b","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0071"} -->

Completed:
- A search can be narrowed to a section, page type and language, and retrieval is measured at 10,000, 50,000 and 200,000 passages and on the live IRS library

Evidence:
- recall@10 0.997 to 1.0 on the synthetic site at every size; 200,000 passages: 0.24 s unfiltered, 2.1 s whole-business prefix; IRS live 1.5 s p50, recall@10 0.838; slow part filed on octo-database#38 and #48

Decisions:
- metadata lives in the title prefix and a workspace table until Octo has a metadata filter

Changed:
- copilot-engine/src/site-search.ts, guide.ts, eval/size/, eval/out/synthetic-*, eval/out/irs-live

Blocked/uncertain:
- none

Next:
- Open the PR for #109

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
