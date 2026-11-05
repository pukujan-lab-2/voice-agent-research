# TASK-WCP-0115 — Desk Offer Guard

<!-- continuity:task {"acceptance": ["The two flagged turns of call 7d689fcd no longer fail their replay case", "Both cases are marked guarded and the snapshot is re-exported in the same pull request"], "depends_on": [], "goal": "The desk never makes an offer in the model's own words; code writes the real offers", "id": "WCP-0115", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/38", "next_action": "None for this task", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "completed", "why": "The desk prompt already forbids offers it can't make and the model ignores it; replaying #38's cases on the live site on 2026-11-05 failed both (#38)"} -->

- Status: completed (merged in #151 as b5fc9c5)
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

The desk never makes an offer in the model's own words; code writes the real offers

## Why

The desk prompt already forbids offers it can't make and the model ignores it; replaying #38's cases on the live site on 2026-11-05 failed both (#38)

## Allowed files

- `copilot-engine/src/guard.ts`, `copilot-engine/src/desk.ts`, `copilot-engine/tests/offers.test.ts` (new), `copilot-engine/package.json`
- `eval/lib/rules.ts`, `eval/lib/replay.ts`, `eval/cases/snapshot.json`
- this task record

## Human outcome

A caller is never promised help Maybe can't give: "just say the word" and "I can help you check" don't reach them.

## Scope and boundaries

- In scope: one guard that drops offer sentences from the model's own text, shared with the eval's invented-offer rule; replaying and guarding #38's two cases.
- Out of scope: the other five open cases from the same call (other rules).

## Acceptance criteria

- [x] The two flagged turns of call 7d689fcd no longer fail their replay case.
- [x] Both cases are marked guarded and the snapshot is re-exported in the same pull request.

## Evidence and sources

- Before: `node eval/replay.ts --snapshot --case <id> --site https://copilot.design-bakery.com` failed both cases; after the guard both pass.
- `npm run check` passes; `copilot-engine/tests/offers.test.ts` covers both replies from the call.

## Related records

- Leaf: #38. Parent: none.
- Primary writer: Claude Code session for the owner / branch `fix/38-desk-invented-offers` / as of 2026-11-05 merged.

## Checkpoint log

No checkpoints yet.

### 2026-11-05 02:07:24 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/guard.ts, desk.ts, tests/offers.test.ts, eval/lib/rules.ts, replay.ts, eval/cases/snapshot.json"],"completed":["The desk drops offer sentences from the model's own text; #38's two cases pass on the live site and are guarded"],"decisions":["Every model-worded offer is dropped (not only ones the intro lacks): the owner counted 'I can help you check' as bad"],"evidence":["npm run check exit 0; replay of both cases against copilot.design-bakery.com: FAIL before, PASS after; npm run replay gate ok"],"next_action":"Merge the pull request once CI passes","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0115","timestamp":"2026-11-05T02:07:24Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"6365cda8c125c3fcb5f22fe4014a054e6a2ef16d8c46be6ac1a161ade5e57894","request_id":"c30d7df181454fc58074c87b533a3860","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0115"} -->

Completed:
- The desk drops offer sentences from the model's own text; #38's two cases pass on the live site and are guarded

Evidence:
- npm run check exit 0; replay of both cases against copilot.design-bakery.com: FAIL before, PASS after; npm run replay gate ok

Decisions:
- Every model-worded offer is dropped (not only ones the intro lacks): the owner counted 'I can help you check' as bad

Changed:
- copilot-engine/src/guard.ts, desk.ts, tests/offers.test.ts, eval/lib/rules.ts, replay.ts, eval/cases/snapshot.json

Blocked/uncertain:
- none

Next:
- Merge the pull request once CI passes

### 2026-11-05 02:51:37 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["Records for WCP-0114 and WCP-0115 say completed with their merges"],"decisions":["no new decisions"],"evidence":["#148 merged as 8ca3bce; #151 merged as b5fc9c5"],"next_action":"None for this task","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0115","timestamp":"2026-11-05T02:51:37Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"df14b4a9ca4eb533fc15198dabfb556e4fb6f02a74c5f5239005832d40832399","request_id":"0e7a8719af1449fcbe2aad127f07bdab","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0115"} -->

Completed:
- Records for WCP-0114 and WCP-0115 say completed with their merges

Evidence:
- #148 merged as 8ca3bce; #151 merged as b5fc9c5

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- None for this task
