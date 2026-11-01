# TASK-WCP-0072 — Search Site Tool

<!-- continuity:task {"acceptance":["search_site returns at most 4 cited results of at most 400 characters","At most 3 calls per turn","Answers remain quotes from a cited passage; nothing found gives the same I don't know"],"depends_on":["WCP-0071"],"goal":"The model can refine a search with a capped, fixed-size search_site tool","id":"WCP-0072","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/110","next_action":"Start the leaf on its task branch","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"One answer_question call cannot refine a vague or two-part question (#110)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: WCP-0071

## Goal

The model can refine a search with a capped, fixed-size search_site tool

## Why

One answer_question call cannot refine a vague or two-part question (#110)

## Allowed files

- `copilot-engine/src/search-site.ts` (new)
- `copilot-engine/src/desk.ts` (small hook only)
- `copilot-engine/tests/search-site.test.ts`
- `tasks/TASK-WCP-0072-search-site-tool.md`

## Human outcome

A vague or two-part question can be refined by the model without losing the citation and quote-only guarantees.

## Scope and boundaries

- In scope: search_site tool, per-turn call cap, fixed-size results, code deciding on top of the model's choice.
- Out of scope: the prompt budget (#101); the page and form map (#104).
- Dependencies/uncertainty: builds on WCP-0071. Octo's RAG has no metadata filter; title paths and an Octo table stand in until Octo adds one.

## Acceptance criteria

- [ ] search_site returns at most 4 cited results of at most 400 characters.
- [ ] At most 3 calls per turn.
- [ ] Answers remain quotes from a cited passage; nothing found gives the same I don't know.

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #110; parent #107; depends on WCP-0071.
- Primary writer claude-code / `task/WCP-0072-*`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
