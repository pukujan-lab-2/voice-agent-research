# TASK-WCP-0072 — Search Site Tool

<!-- continuity:task {"acceptance":["search_site returns at most 4 cited results of at most 400 characters","At most 3 calls per turn","Answers remain quotes from a cited passage; nothing found gives the same I don't know"],"depends_on":["WCP-0071"],"goal":"The model can refine a search with a capped, fixed-size search_site tool","id":"WCP-0072","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/34","next_action":"Start the leaf on its task branch","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"One answer_question call cannot refine a vague or two-part question (#34)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: WCP-0071

## Goal

The model can refine a search with a capped, fixed-size search_site tool

## Why

One answer_question call cannot refine a vague or two-part question (#34)

## Allowed files

- `copilot-engine/src/search-site.ts` (new)
- `copilot-engine/src/desk.ts` (small hook only)
- `copilot-engine/tests/search-site.test.ts`
- `tasks/TASK-WCP-0072-search-site-tool.md`

## Human outcome

A vague or two-part question can be refined by the model without losing the citation and quote-only guarantees.

## Scope and boundaries

- In scope: search_site tool, per-turn call cap, fixed-size results, code deciding on top of the model's choice.
- Out of scope: the prompt budget (#26); the page and form map (#29).
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

- Leaf #34; parent #31; depends on WCP-0071.
- Primary writer claude-code / `task/WCP-0072-*`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 18:52:46 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/search-site.ts, desk.ts, guide.ts, tests/search-site.test.ts"],"completed":["The model can look through a site with a capped, fixed-size search_site tool before it answers, and replies are still quotes from a cited passage"],"decisions":["answer_question takes the section and page type a search showed; the live site is not wired until per-business config (#103)"],"evidence":["npm run check passes; 15 new tests: 4 results of 400 characters, 3 searches and 3 trips per turn, dropped filters, quote-only unchanged"],"next_action":"Open the PR for #110","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0072","timestamp":"2026-11-01T18:52:46Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"d61b7c0164126d53629f314a6457ad6b02523d135f76be48b5e0af37faded141","request_id":"f0a502a92b6042068c79d89ea4b58a80","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0072"} -->

Completed:
- The model can look through a site with a capped, fixed-size search_site tool before it answers, and replies are still quotes from a cited passage

Evidence:
- npm run check passes; 15 new tests: 4 results of 400 characters, 3 searches and 3 trips per turn, dropped filters, quote-only unchanged

Decisions:
- answer_question takes the section and page type a search showed; the live site is not wired until per-business config (#103)

Changed:
- copilot-engine/src/search-site.ts, desk.ts, guide.ts, tests/search-site.test.ts

Blocked/uncertain:
- none

Next:
- Open the PR for #110

### 2026-11-01 23:19:11 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["tasks/TASK-WCP-0072-search-site-tool.md (merge of main)"],"completed":["The search_site branch sits on the moved repository's main"],"decisions":["none"],"evidence":["npm run check passes on the stack after merging the moved repository's main; issue links point at pukujan-lab-2"],"next_action":"Merge PR #54 after #53","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0072","timestamp":"2026-11-01T23:19:11Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"a8ade9c4d59b66669bddb28f09a9ab14d54e07f736007e3f8a218b0ee4a4202e","request_id":"d5cde6b617054907bfa5c3cd300bb380","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0072"} -->

Completed:
- The search_site branch sits on the moved repository's main

Evidence:
- npm run check passes on the stack after merging the moved repository's main; issue links point at pukujan-lab-2

Decisions:
- none

Changed:
- tasks/TASK-WCP-0072-search-site-tool.md (merge of main)

Blocked/uncertain:
- none

Next:
- Merge PR #54 after #53

### 2026-11-01 23:19:33 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["tasks/TASK-WCP-0072-*.md"],"completed":["Carried the earlier branch's final state into this one so the stacked pull requests merge cleanly in order"],"decisions":["none"],"evidence":["merge of task/WCP-0071-retrieval-at-size; npm run check passed on the stack top just before"],"next_action":"Merge PR #54 after #53","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0072","timestamp":"2026-11-01T23:19:33Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"0c42dd2fcac7115b9cb8a7b4ee79de09edc31e5705330b612984cb528e7c2fa7","request_id":"66a09744c171495ab4062b19f5cac57a","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0072"} -->

Completed:
- Carried the earlier branch's final state into this one so the stacked pull requests merge cleanly in order

Evidence:
- merge of task/WCP-0071-retrieval-at-size; npm run check passed on the stack top just before

Decisions:
- none

Changed:
- tasks/TASK-WCP-0072-*.md

Blocked/uncertain:
- none

Next:
- Merge PR #54 after #53

### 2026-11-01 23:23:48 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["tasks/, copilot-engine/package.json"],"completed":["Merged the moved repository's main (which now holds the first two PRs' content) into this branch so it merges cleanly"],"decisions":["none"],"evidence":["npm run check passes after the merge: 92 engine tests, 16 eval tests, 31 Python tests, scenarios"],"next_action":"Merge PR #54, then #55 and #56","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0072","timestamp":"2026-11-01T23:23:48Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"e1105225d12bdc1c03d74e06dff47ca4ff8c415bebe05a48f9c751f4b5fa21d2","request_id":"75bf2bd6de6d47c8a2b38c5b4c892bea","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0072"} -->

Completed:
- Merged the moved repository's main (which now holds the first two PRs' content) into this branch so it merges cleanly

Evidence:
- npm run check passes after the merge: 92 engine tests, 16 eval tests, 31 Python tests, scenarios

Decisions:
- none

Changed:
- tasks/, copilot-engine/package.json

Blocked/uncertain:
- none

Next:
- Merge PR #54, then #55 and #56

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
