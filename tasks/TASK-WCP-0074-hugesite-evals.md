# TASK-WCP-0074 — Hugesite Evals

<!-- continuity:task {"acceptance":["Citation present, quote word for word in the cited passage, no undeclared field, no cross-business data, all by code","Runs in CI without keys"],"depends_on":["WCP-0070","WCP-0071","WCP-0072","WCP-0073"],"goal":"Automated code-check evals for facts, vague questions and record lookups on a large site","id":"WCP-0074","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/36","next_action":"Start the leaf on its task branch","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The new layer has no end-to-end check (#36)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: WCP-0070, WCP-0071, WCP-0072, WCP-0073

## Goal

Automated code-check evals for facts, vague questions and record lookups on a large site

## Why

The new layer has no end-to-end check (#36)

## Allowed files

- `eval/config/hugesite.json`
- `eval/hugesite.ts and eval/lib/ additions`
- `eval/tests/`
- `eval/README.md`
- `docs/retrieval-limits.md`, `docs/decisions/0018-…md` and its index line, `PROJECT.md` status row
- `tasks/TASK-WCP-0074-hugesite-evals.md`

## Human outcome

One command shows whether the huge-site layer still answers with a real citation, quotes word for word and leaks nothing.

## Scope and boundaries

- In scope: a business config for a synthetic large site and a database; simulated callers; code checks only.
- Out of scope: new model runs or comparisons.
- Dependencies/uncertainty: builds on WCP-0070, WCP-0071, WCP-0072, WCP-0073. Octo's RAG has no metadata filter; title paths and an Octo table stand in until Octo adds one.

## Acceptance criteria

- [ ] Citation present, quote word for word in the cited passage, no undeclared field, no cross-business data, all by code.
- [ ] Runs in CI without keys.

## Evidence and sources

Observed on branch `task/WCP-0074-hugesite-evals` (stacked on #108 to #111):

- `node eval/hugesite.ts` passes at 3,000 passages (3,750 with the second business, 94 callers, under 1 s) and at 20,000 (25,000 with the second business, 7.8 s): 40 fact callers (gold passage cited 100%), 20 vague, 10 unanswerable (the configured "I don't know"), 12 record callers in eight shapes, 12 hostile-model callers over 7 turns each.
- `npm run check` passes, with 5 new eval tests; 4 are negative controls: a private column that reaches the caller, tables shared with no business column, and an unreachable pass mark each make the run fail, and the same seed gives the same report.
- Limits of what this shows: the retriever here is a word-overlap stand-in for Octo and the judge is the word-overlap judge, so the numbers prove the guarantees (citation, quote, scope, caps), not retrieval quality; that is eval/size and the IRS figures in docs/retrieval-limits.md.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #36; parent #31; depends on WCP-0070, WCP-0071, WCP-0072, WCP-0073.
- Primary writer claude-code / `task/WCP-0074-*`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 19:05:43 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["eval/hugesite.ts, eval/lib/hugesite.ts, docs/retrieval-limits.md, docs/decisions/0018-*.md, PROJECT.md"],"completed":["One command checks the huge-site layer end to end, and its measured limits and the decision behind it are written down"],"decisions":["decision 0018: search for prose, declared lookups for records"],"evidence":["npm run check passes; node eval/hugesite.ts passes at 3,000 and 20,000 passages (94 callers) with 4 negative controls; docs/retrieval-limits.md has the figures"],"next_action":"Open the PR for #112; post the before-and-after table on #107 once the PRs merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0074","timestamp":"2026-11-01T19:05:43Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"bd4c8f0010185fb3a519a7ad352754ce9855493c34e29c4d2dc768cb5dde0cf6","request_id":"3bc69e3976c64e3db81bc922c6588a59","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0074"} -->

Completed:
- One command checks the huge-site layer end to end, and its measured limits and the decision behind it are written down

Evidence:
- npm run check passes; node eval/hugesite.ts passes at 3,000 and 20,000 passages (94 callers) with 4 negative controls; docs/retrieval-limits.md has the figures

Decisions:
- decision 0018: search for prose, declared lookups for records

Changed:
- eval/hugesite.ts, eval/lib/hugesite.ts, docs/retrieval-limits.md, docs/decisions/0018-*.md, PROJECT.md

Blocked/uncertain:
- none

Next:
- Open the PR for #112; post the before-and-after table on #107 once the PRs merge

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
