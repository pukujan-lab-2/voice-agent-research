# TASK-WCP-0002 — IRS library load

<!-- continuity:task {"acceptance": ["All fetched passages (about 880k) are in Octo", "A spot search per source (IRC, CFR, Forms, IRB, IRM) returns them", "The IRS eval report states current search latency"], "depends_on": [], "goal": "Load the IRS library into Octo and keep its report current", "id": "WCP-0002", "issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/8", "next_action": "Let the 4-worker ingest finish (resumes from build/lib/ingested.jsonl), then run one spot search per source", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The tax-site copilot answers from this library; slow or missing search means wrong answers"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Load the IRS library into Octo and keep its report current.

## Why

The tax-site copilot answers from this library; slow or missing search means wrong answers

## Allowed files

- `eval/out/irs/`
- `demo/live-site/tools/lib_ingest.py`
- this task file

## Human outcome

Callers on the tax site get answers grounded in the whole IRS library, fast enough to beat the site's 30 s timeout.

## Scope and boundaries

- In scope: finishing the ingest, spot searches, and the latency figures in the IRS report.
- Out of scope: answer-quality evals (#15).
- Dependencies/uncertainty: about 8 days of ingest remained as of the issue body; progress is not re-measured here.

## Acceptance criteria

- [ ] All fetched passages are in Octo.
- [ ] A spot search per source (IRC, CFR, Forms, IRB, IRM) returns them.
- [x] The report states search latency after Octo's search fix (re-measured 2026-10-31 19:33 UTC).

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf issue: #18. Parent: none. Dependencies: none.
- Branch: `docs/18-irs-latency-remeasure`. As of 2026-10-31.
- PR and receipt: posted on #18.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 01:46:16 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["eval/out/irs/report-pre-880k.md, tasks/TASK-WCP-0002-irs-library-load.md"],"completed":["Committed the re-measured IRS search latency (left uncommitted in an idle worktree) and added the #18 task record"],"decisions":["no new decisions"],"evidence":["node eval/latency.ts, 40 questions, 2026-10-31 19:33 UTC: search p50 8.78 s, answer p50 9.11 s, 0 over 30 s; npm run check passed"],"next_action":"Let the ingest finish, then run one spot search per source (IRC, CFR, Forms, IRB, IRM)","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0002","timestamp":"2026-11-01T01:46:16Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"44e627784e4f2803c776c66bc4f7bf6fc60449f586a29cdc4935a75629a103c0","request_id":"d694ef87e7c34aa5870632b3407164ca","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0002"} -->

Completed:
- Committed the re-measured IRS search latency (left uncommitted in an idle worktree) and added the #18 task record

Evidence:
- node eval/latency.ts, 40 questions, 2026-10-31 19:33 UTC: search p50 8.78 s, answer p50 9.11 s, 0 over 30 s; npm run check passed

Decisions:
- no new decisions

Changed:
- eval/out/irs/report-pre-880k.md, tasks/TASK-WCP-0002-irs-library-load.md

Blocked/uncertain:
- none

Next:
- Let the ingest finish, then run one spot search per source (IRC, CFR, Forms, IRB, IRM)

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
