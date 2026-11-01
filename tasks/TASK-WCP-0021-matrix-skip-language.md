# TASK-WCP-0021 — The voice matrix survives a language that won't load

<!-- continuity:task {"acceptance": ["A language whose clips fail to load is retried up to three times, then skipped, and the run continues", "The report names each skipped language and its error", "The full run completes and its report is posted on #82"], "depends_on": [], "goal": "The voice matrix finishes even when one language's reference speech won't load", "id": "WCP-0021", "issue_url": "https://github.com/Pukujan-lab/voice-agent-research/issues/86", "next_action": "Rerun the full matrix and post its report on #82", "owner": "owner", "priority": "P2", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The first full run died at the Chinese clips after four stacks were scored, so no report existed (#86)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

The voice matrix finishes even when one language's reference speech won't load.

## Why

The first full run died at the Chinese clips (Hugging Face's row service: "Unexpected error") after four stacks were scored, so no report was written (#86).

## Allowed files

- `demo/live-site/tests/voice-matrix.ts`
- `tasks/TASK-WCP-0021-matrix-skip-language.md`

## Human outcome

The owner gets a full report even when one dataset is down, and it says what wasn't scored.

## Scope and boundaries

- In scope: retry, skip and report in the runner.
- Out of scope: other datasets, the scores themselves.

## Acceptance criteria

- [ ] A failing language is retried three times, then skipped.
- [ ] The report names the skipped language and the error.
- [ ] The full run's report is posted on #82.

## Evidence and sources

- Run log 2026-11-01: `Error: google/fleurs cmn_hans_cn: Unexpected error.`

## Related records

- Leaf #86; parent none; depends on none; related #82.
- Primary writer / branch: claude-code / `fix/86-matrix-skip-language`; source issue open as of 2026-11-01.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 09:19:55 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["One dataset that won't load no longer kills the whole voice matrix run: the runner retries three times, skips that language and names it in the report"],"decisions":["no new decisions"],"evidence":["npm run check passes; the full five-stack rerun is in progress"],"next_action":"Post the full run's report on #82","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0021","timestamp":"2026-11-01T09:19:55Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"3b485922ed4b72bafc5370d5c369477db577def797adb50cfb469593504e31f9","request_id":"d4c8d3edd7b743d496c15ef6828e097c","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0021"} -->

Completed:
- One dataset that won't load no longer kills the whole voice matrix run: the runner retries three times, skips that language and names it in the report

Evidence:
- npm run check passes; the full five-stack rerun is in progress

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Post the full run's report on #82

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
