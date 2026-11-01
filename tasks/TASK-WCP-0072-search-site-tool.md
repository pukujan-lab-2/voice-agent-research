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

Observed on branch `task/WCP-0072-search-site-tool` (stacked on #108 and #109):

- `npm run check` passes; 15 new tests in `copilot-engine/tests/search-site.test.ts` (75 engine tests in all at that point).
- A call returns at most 4 passages of at most 400 characters; with a 50-passage site of 5,000-character passages the model-facing text stayed under 2,600 characters.
- The fourth search in a turn is refused with a note; a model that searches every round gets 3 searches and at most 4 trips to the model, then its answer is used.
- A section or page type that finds nothing is dropped once and the model is told; `answer_question` does the same, so a wrong guess at a section is not an "I don't know".
- Quote-only is unchanged: replies in the tests are a stored passage or the same unknown line; a search alone never speaks. At most 3 `answer_question` lookups per turn.
- Not wired into the live site: `demo/live-site/api.ts` builds the retriever per business, which belongs to the per-business config work (#103).

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
