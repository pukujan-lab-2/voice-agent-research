# TASK-WCP-0022 — Mine Flagged Turns

<!-- continuity:task {"acceptance":["`eval/mine.ts` reads the newest spans from the chatbots workspace only and flags turns with plain code rules","The 2026-11-01 17:10 call (session 7d689fcd) is flagged for its judge-dropped answer, its vague \"Yeah.\" and the repeated quote","The flagged table is stored in an Octo table and printed; no local copy","`npm run check` passes"],"depends_on":[],"goal":"Flag suspect turns in real calls with plain code rules","id":"WCP-0022","next_action":"Write the rules and run them on the recorded 2026-11-01 call","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"Bad real turns reach the owner as complaints; nothing flags them (#89)"} -->

- Status: completed
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Flag suspect turns in real calls with plain code rules

## Why

Bad real turns reach the owner as complaints; nothing flags them (#89)

## Allowed files

- `eval/mine.ts`
- `eval/lib/rules.ts`
- `eval/lib/spans.ts`
- `eval/lib/flags.ts`
- `eval/tests/mine.test.ts`
- `eval/tests/fixtures/call-7d689fcd.json`
- `knip.json`
- `package.json`
- `eval/README.md`
- `tasks/TASK-WCP-0022-mine-flagged-turns.md`

## Human outcome

The owner no longer has to complain for a bad real turn to be noticed: a script lists the suspect turns of recent calls, with the rule that caught each.

## Scope and boundaries

- In scope: reading spans from the chatbots workspace, the plain-code rules, the table stored in Octo and printed.
- Out of scope: replay cases (WCP-0023), any model-based judging, the nyc-map-agent workspace.
- Dependencies/uncertainty: none

## Acceptance criteria

- [x] `eval/mine.ts` reads the newest spans from the chatbots workspace only and flags turns with plain code rules
- [x] The 2026-11-01 17:10 call (session 7d689fcd) is flagged for its judge-dropped answer, its vague "Yeah." and the repeated quote
- [x] The flagged table is stored in an Octo table and printed; no local copy
- [x] `npm run check` passes

## Evidence and sources

Live spans read from the chatbots workspace on 2026-11-01 (call 7d689fcd-fe99-439c-8350-6305244e2875); parent #88.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #89; parent #88; depends on none; related #17, #12, #13, #15.
- Primary writer / branch: claude-code / `task/WCP-0022-mine-flagged-turns`; merged in #95; issue #89 closed.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 17:32:20 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["eval/mine.ts, eval/lib/{spans,rules,flags}.ts, eval/tests/, eval/README.md, knip.json, package.json"],"completed":["Real calls are now mined: eval/mine.ts flags suspect turns with seven plain-code rules and stores them in Octo's flagged_turns table"],"decisions":["A flag is keyed by call, turn and rule, so mining twice updates rows; the repeat rule looks four turns back because the owner's repeated Publication 570 quote came three turns after the first"],"evidence":["Rules flag the four bad turns of the 2026-11-01 17:10 call (7 tests on the recorded call); a live run stored 20 flags over 7 recent calls and a re-run added none; npm run check passes"],"next_action":"Merge, then start WCP-0023 (replay cases) on #90","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0022","timestamp":"2026-11-01T17:32:20Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"d3ddb12546a05af593ffc429385cd1b3d9a4cab6e694a5a35e956a8d604b9545","request_id":"8ac17de7614f4de3bf6418481ff0f1aa","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0022"} -->

Completed:
- Real calls are now mined: eval/mine.ts flags suspect turns with seven plain-code rules and stores them in Octo's flagged_turns table

Evidence:
- Rules flag the four bad turns of the 2026-11-01 17:10 call (7 tests on the recorded call); a live run stored 20 flags over 7 recent calls and a re-run added none; npm run check passes

Decisions:
- A flag is keyed by call, turn and rule, so mining twice updates rows; the repeat rule looks four turns back because the owner's repeated Publication 570 quote came three turns after the first

Changed:
- eval/mine.ts, eval/lib/{spans,rules,flags}.ts, eval/tests/, eval/README.md, knip.json, package.json

Blocked/uncertain:
- none

Next:
- Merge, then start WCP-0023 (replay cases) on #90

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
