# TASK-WCP-0005 — LFM3 writes replies

<!-- continuity:task {"acceptance":["Decision 0009 replaces 0006: LFM3 writes replies and makes the form decision, Jev 1.14 keeps the yes/no and passage picks","0006 is marked Replaced by 0009 and the decision index lists 0009","copilot-engine/PLAN.md no longer names typesafe/jev-router as the product model","The desk-sim usage example no longer suggests Qwen-Flash"],"depends_on":[],"goal":"Replace Qwen-Flash with LFM3 for the copilot's replies","id":"WCP-0005","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/39","next_action":"Open the pull request for #39 and merge it once CI passes","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The owner doesn't want Qwen-Flash (2026-11-01), and decision 0006 still names it"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Replace Qwen-Flash with LFM3 for the copilot's replies.

## Why

The owner doesn't want Qwen-Flash (2026-11-01), and decision 0006 still names it.

## Allowed files

- `docs/decisions/0006-model-routing.md`, `docs/decisions/0009-lfm3-writes-replies.md`, `docs/decisions/README.md`
- `copilot-engine/PLAN.md`, `copilot-engine/tests/desk-sim.ts` (comment only)
- this task file

## Human outcome

The records say what the owner chose, so no later session wires Qwen-Flash back in.

## Scope and boundaries

- In scope: the decision records and the two stale lines in `PLAN.md` and `desk-sim.ts`.
- Out of scope: closing LFM3's reply-quality gap, and any new model runs (the owner said no more runs).
- Dependencies/uncertainty: none. No code path used Qwen-Flash; the v2 desk already defaults to LFM3.

## Acceptance criteria

- [x] Decision 0009 replaces 0006.
- [x] 0006 is marked *Replaced by 0009*, and the index lists 0009.
- [x] `copilot-engine/PLAN.md` no longer names `typesafe/jev-router` as the product model.
- [x] The desk-sim usage example says `--agent lfm`.
- [ ] The pull request passes required CI and merges.

## Evidence and sources

- Desk results on `main` at `2df0e50`: `copilot-engine/tests/desk-final-lfm3.json` and `desk-final-qwen-flash.json` (80 conversations each, seed 12).

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #39; parent none; depends on none. Related: #16, #37.
- Primary writer / branch / source issue revision / as-of status: claude-code / `docs/39-lfm3-replies` / issue #39 as of 2026-11-01 / open.
- Related PR/CI evidence and push receipt (request ID / SHA): the receipt follows the checkpoint push.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 02:11:47 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["docs/decisions/0009-lfm3-writes-replies.md","docs/decisions/0006-model-routing.md","docs/decisions/README.md","copilot-engine/PLAN.md","copilot-engine/tests/desk-sim.ts","copilot-engine/ledger.jsonl"],"completed":["Wrote decision 0009 (LFM3 writes replies), marked 0006 replaced, updated the decision index, and fixed the stale model lines in copilot-engine/PLAN.md and desk-sim.ts"],"decisions":["LFM3 writes replies; no further model comparison runs (owner, 2026-11-01)"],"evidence":["npm run check passes: lint, ruff, typecheck, knip; npm test 33/33; scenarios 8/8"],"evidence_class":"observed","next_action":"Open the pull request for #39 and merge it once CI passes","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0005","timestamp":"2026-11-01T02:11:47Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"7cb18324f78c5039df85d95d26b3b77263a741fce0671ad61941d39ba7f2dd47","request_id":"8ce74f8142b04e7b878d663b03960cb3","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0005"} -->

Completed:
- Wrote decision 0009 (LFM3 writes replies), marked 0006 replaced, updated the decision index, and fixed the stale model lines in copilot-engine/PLAN.md and desk-sim.ts

Evidence:
- npm run check passes: lint, ruff, typecheck, knip; npm test 33/33; scenarios 8/8

Decisions:
- LFM3 writes replies; no further model comparison runs (owner, 2026-11-01)

Changed:
- docs/decisions/0009-lfm3-writes-replies.md
- docs/decisions/0006-model-routing.md
- docs/decisions/README.md
- copilot-engine/PLAN.md
- copilot-engine/tests/desk-sim.ts
- copilot-engine/ledger.jsonl

Blocked/uncertain:
- none

Next:
- Open the pull request for #39 and merge it once CI passes

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
