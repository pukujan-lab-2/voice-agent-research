# TASK-WCP-0042 — Business Config

<!-- continuity:task {"acceptance":["A business's config is stored in Octo by business and loaded on demand through a bounded cache","/api/desk refuses a voice stack the business does not allow","Two businesses with the same session ids and page paths never read each other's config or snapshot (test)","A page can mount with only its business id"],"depends_on":[],"goal":"Each business's copilot config is stored in Octo and loaded on demand","id":"WCP-0042","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/103","next_action":"None for this task","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"The page sends the whole config with requests, so the server can't enforce a business's allowed voice stacks and a big config rides every request (#103)"} -->

- Status: completed (merged in #50 as 54b815d; #103 stays open for work beyond this task)
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Each business's copilot config is stored in Octo and loaded on demand

## Why

The page sends the whole config with requests, so the server can't enforce a business's allowed voice stacks and a big config rides every request (#103)

## Allowed files

- `copilot-engine/src/site-config.ts`, `copilot-engine/tests/site-config.test.ts`, `copilot-engine/package.json`
- `demo/live-site/api.ts`, `widget/sdk.ts`, `widget/remote.ts`, `tools/site-config.ts`, `package.json`, `tests/state.test.ts`
- `docs/scaling-limits.md`
- `tasks/TASK-WCP-0042-business-config.md`

## Human outcome

A business's settings live on the server, so a large site sends only its id and the server can hold each call to what that business allows.

## Scope and boundaries

- In scope: the config table and loader, the endpoint, the stack check, the widget's remote mount, a put tool, tests, limits doc.
- Out of scope: an admin UI; per-form storage (#104).
- Dependencies/uncertainty: stacked on #102's branch.

## Acceptance criteria

- [ ] Config stored and loaded by business; cache bounded.
- [ ] Stack check on /api/desk.
- [ ] Isolation test between two businesses.

## Evidence and sources

Observed 2026-11-01: SiteConfigs put, get and remove against the live Octo workspace on a scratch table (dropped afterwards).

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #103; parent #100; depends on #102.
- Primary writer claude-code / `task/WCP-0042-business-config`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

### 2026-11-04 19:54:01 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["merged main into the branch; #49's commits replaced by main's squashed copy; #50's own config change kept; stack check moved before smart escalation"],"decisions":["no new decisions"],"evidence":["npm run check exit 0: 159, 51 and 81 pass, 0 fail; PR diff vs main 11 files +319/-9"],"next_action":"PR #50 merges through CI; then site key and allowed domains on the config (#121 phase 0)","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0042","timestamp":"2026-11-04T19:54:01Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"693156c68690c8b22497781e2711ce82acc745786712a93f8c261d81de065c14","request_id":"962cee6fc0804086862152753b64be24","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0042"} -->

Completed:
- merged main into the branch; #49's commits replaced by main's squashed copy; #50's own config change kept; stack check moved before smart escalation

Evidence:
- npm run check exit 0: 159, 51 and 81 pass, 0 fail; PR diff vs main 11 files +319/-9

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- PR #50 merges through CI; then site key and allowed domains on the config (#121 phase 0)

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
