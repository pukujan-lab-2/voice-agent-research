# TASK-WCP-0115 — Desk Offer Guard

<!-- continuity:task {"acceptance": ["The two flagged turns of call 7d689fcd no longer fail their replay case", "Both cases are marked guarded and the snapshot is re-exported in the same pull request"], "depends_on": [], "goal": "The desk never makes an offer in the model's own words; code writes the real offers", "id": "WCP-0115", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/38", "next_action": "Merge the pull request once CI passes", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The desk prompt already forbids offers it can't make and the model ignores it; replaying #38's cases on the live site on 2026-11-05 failed both (#38)"} -->

- Status: active
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
- Primary writer: Claude Code session for the owner / branch `fix/38-desk-invented-offers` / as of 2026-11-05 PR open.

## Checkpoint log

No checkpoints yet.
