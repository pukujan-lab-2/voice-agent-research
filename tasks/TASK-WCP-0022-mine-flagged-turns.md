# TASK-WCP-0022 — Mine Flagged Turns

<!-- continuity:task {"acceptance":["`eval/mine.ts` reads the newest spans from the chatbots workspace only and flags turns with plain code rules","The 2026-11-01 17:10 call (session 7d689fcd) is flagged for its judge-dropped answer, its vague \"Yeah.\" and the repeated quote","The flagged table is stored in an Octo table and printed; no local copy","`npm run check` passes"],"depends_on":[],"goal":"Flag suspect turns in real calls with plain code rules","id":"WCP-0022","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/89","next_action":"Write the rules and run them on the recorded 2026-11-01 call","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Bad real turns reach the owner as complaints; nothing flags them (#89)"} -->

- Status: active
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
- `eval/README.md`
- `tasks/TASK-WCP-0022-mine-flagged-turns.md`

## Human outcome

The owner no longer has to complain for a bad real turn to be noticed: a script lists the suspect turns of recent calls, with the rule that caught each.

## Scope and boundaries

- In scope: reading spans from the chatbots workspace, the plain-code rules, the table stored in Octo and printed.
- Out of scope: replay cases (WCP-0023), any model-based judging, the nyc-map-agent workspace.
- Dependencies/uncertainty: none

## Acceptance criteria

- [ ] `eval/mine.ts` reads the newest spans from the chatbots workspace only and flags turns with plain code rules
- [ ] The 2026-11-01 17:10 call (session 7d689fcd) is flagged for its judge-dropped answer, its vague "Yeah." and the repeated quote
- [ ] The flagged table is stored in an Octo table and printed; no local copy
- [ ] `npm run check` passes

## Evidence and sources

Live spans read from the chatbots workspace on 2026-11-01 (call 7d689fcd-fe99-439c-8350-6305244e2875); parent #88.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #89; parent #88; depends on none; related #17, #12, #13, #15.
- Primary writer / branch: claude-code / `task/WCP-0022-*` (not started); source issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
