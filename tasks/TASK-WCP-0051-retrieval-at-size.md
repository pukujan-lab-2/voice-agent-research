# TASK-WCP-0051 — Retrieval At Size

<!-- continuity:task {"acceptance":["A filter never returns a passage outside it (tests)","recall@5/10, MRR and latency reported at each size for the synthetic site and the IRS library","What is slow is filed in the Octo repo with measurements"],"depends_on":["WCP-0050"],"goal":"Search narrows by section, page type and language and holds up at 200,000 passages, with measured figures","id":"WCP-0051","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/109","next_action":"Start the leaf on its task branch","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Search has no filters and nobody has measured it beyond 133,000 passages (#109)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: WCP-0050

## Goal

Search narrows by section, page type and language and holds up at 200,000 passages, with measured figures

## Why

Search has no filters and nobody has measured it beyond 133,000 passages (#109)

## Allowed files

- `copilot-engine/src/guide.ts` (OctoRetriever filters)
- `copilot-engine/tests/` (filter tests)
- `eval/retrieval.py, eval/lib/, eval/size/` (synthetic site and size test)
- `docs/retrieval-limits.md`
- `tasks/TASK-WCP-0051-retrieval-at-size.md`

## Human outcome

A visitor's question can be narrowed to a section, page type or language, and the owner knows how fast and how accurate search is at each size.

## Scope and boundaries

- In scope: filters by section, page type and language; a synthetic site generator; recall@5/10, MRR and latency at 10k, 50k and 200k passages and on the IRS library; Octo issues for what is slow.
- Out of scope: changing Octo itself; a local copy of the data.
- Dependencies/uncertainty: builds on WCP-0050. Octo's RAG has no metadata filter; title paths and an Octo table stand in until Octo adds one.

## Acceptance criteria

- [ ] A filter never returns a passage outside it (tests).
- [ ] recall@5/10, MRR and latency reported at each size for the synthetic site and the IRS library.
- [ ] What is slow is filed in the Octo repo with measurements.

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #109; parent #107; depends on WCP-0050.
- Primary writer claude-code / `task/WCP-0051-*`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
