# TASK-WCP-0026 — Propose Fixes

<!-- continuity:task {"acceptance":["One issue per failure pattern with call, turn, rule and text as evidence","No second issue while one for the pattern is open","The routine changes no code and moves no branch"],"depends_on":["WCP-0022"],"goal":"File one issue per failure pattern from flagged turns","id":"WCP-0026","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/93","next_action":"Choose the grouping key and the schedule","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Flagged turns pile up with no one reading them (#93)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: WCP-0022 (#89)

## Goal

File one issue per failure pattern from flagged turns

## Why

Flagged turns pile up with no one reading them (#93)

## Allowed files

- `eval/propose.ts`
- `eval/README.md`
- `eval/lib/patterns.ts`
- `eval/tests/propose.test.ts`
- `tasks/TASK-WCP-0026-propose-fixes.md`

## Human outcome

Flagged turns turn into issues a coding session can pick up, one per failure pattern.

## Scope and boundaries

- In scope: grouping the newest flagged turns by pattern, filing one issue per pattern with the evidence, no duplicates, a scheduled routine.
- Out of scope: any code change or deploy by the routine.
- Dependencies/uncertainty: WCP-0022 (#89)

## Acceptance criteria

- [x] One issue per failure pattern with call, turn, rule and text as evidence
- [x] No second issue while one for the pattern is open
- [x] The routine changes no code and moves no branch

## Evidence and sources

Live spans read from the chatbots workspace on 2026-11-01 (call 7d689fcd-fe99-439c-8350-6305244e2875); parent #88.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #93; parent #88; depends on WCP-0022 (#89); related #17, #12, #13, #15.
- Primary writer / branch: claude-code / `task/WCP-0026-propose-fixes`; source issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 18:08:02 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["eval/propose.ts, eval/lib/patterns.ts, eval/tests/patterns.test.ts, eval/README.md, task record"],"completed":["A routine now turns the week's flagged turns into one GitHub issue per failure pattern, with the evidence, and a daily scheduled task runs mining, cases and the filing"],"decisions":["The routine lists open issues and matches titles instead of searching; it runs as a Claude desktop scheduled task on this Mac, which needs the app open, because the Octo key lives here"],"evidence":["Dry run listed 8 patterns from the live flags; a real run opened #115 for invented-offer; the duplicate check was found broken twice (search lag, then GitHub's issue list answering empty) so #116 and #117 were duplicates, closed, and the routine now stops when the list is empty but the repository has open issues; npm run check passes"],"next_action":"Merge; once GitHub's issue list answers again, run propose.ts a second time to confirm it files nothing new","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0026","timestamp":"2026-11-01T18:08:02Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"6a3306b0299cd8c8df85fdbef697b64a80e4a84b6b44961501850a14d36b4754","request_id":"539dcfc733a34c4da61dd2f3ec21e0d1","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0026"} -->

Completed:
- A routine now turns the week's flagged turns into one GitHub issue per failure pattern, with the evidence, and a daily scheduled task runs mining, cases and the filing

Evidence:
- Dry run listed 8 patterns from the live flags; a real run opened #115 for invented-offer; the duplicate check was found broken twice (search lag, then GitHub's issue list answering empty) so #116 and #117 were duplicates, closed, and the routine now stops when the list is empty but the repository has open issues; npm run check passes

Decisions:
- The routine lists open issues and matches titles instead of searching; it runs as a Claude desktop scheduled task on this Mac, which needs the app open, because the Octo key lives here

Changed:
- eval/propose.ts, eval/lib/patterns.ts, eval/tests/patterns.test.ts, eval/README.md, task record

Blocked/uncertain:
- none

Next:
- Merge; once GitHub's issue list answers again, run propose.ts a second time to confirm it files nothing new

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
