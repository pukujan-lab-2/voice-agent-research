# TASK-WCP-0013 — Risk Bands

<!-- continuity:task {"acceptance":["The desk fills each field by its risk score: up to 30 said in passing, 31 to 55 read back, from 56 a clear yes held by code, from 76 a second \"are you sure?\" (and twice before a skip), from 91 never filled","After a misheard value every remaining step scores 15 higher","A page sets a field's score with data-copilot-risk, and each fill goes to Phoenix with its score, read-back and yes","npm run check passes, with desk tests for every band and the +15 rule"],"depends_on":[],"goal":"Confirm each field on the live site by its risk score (decision 0011)","id":"WCP-0013","next_action":"Merge the risk-band PR once CI passes, then close #56","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Every field was read back and needed a yes, so a time slot took as long as a name, and nothing marked a field as needing a person"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Confirm each field on the live site by its risk score (decision 0011)

## Why

Every field was read back and needed a yes, so a time slot took as long as a name, and nothing marked a field as needing a person

## Allowed files

- `copilot-engine/src/desk.ts`, `page.ts`, `types.ts`
- `copilot-engine/tests/desk.test.ts`, `tests/desk-memory.test.ts`
- `demo/live-site/widget/sdk.ts`, `demo/live-site/tests/scenes.ts`
- this task file

## Human outcome

Callers aren't asked to confirm a pick from a short list, but anything risky still needs their clear yes, or a person. Once the desk has misheard something, it gets more careful for the rest of the call.

## Scope and boundaries

- In scope: the desk's confirmation rules, the page attribute, the Phoenix span per fill, and the tests.
- Out of scope: ticking terms or consent boxes. The desk never ticks them, which is stricter than 0011's summary-and-agree rule. Call memory and resume (#57).
- Dependencies/uncertainty: built on #16 (merged in #58) and decision 0011 (#53).

## Acceptance criteria

- [ ] The desk fills each field by its risk score: up to 30 said in passing, 31 to 55 read back, from 56 a clear yes held by code, from 76 a second "are you sure?" (and twice before a skip), from 91 never filled
- [ ] After a misheard value every remaining step scores 15 higher
- [ ] A page sets a field's score with data-copilot-risk, and each fill goes to Phoenix with its score, read-back and yes
- [ ] npm run check passes, with desk tests for every band and the +15 rule

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf issue: #56. Parent: none. Dependencies: #16 (closed, PR #58), decision 0011 (PR #53).
- Primary writer: claude-code. Branch: `feat/56-risk-bands`. Recorded on #56 (issuecomment-6552904661), 2026-11-01.
- PR and receipt: posted on #56.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 03:39:55 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["The desk confirms each field by its risk score from decision 0011: picks said in passing, typed values read back, a clear yes held by code from 56, are-you-sure from 76, a person from 91, and 15 more after a mishearing; fills go to Phoenix with their score"],"decisions":["no new decisions"],"evidence":["npm run check passes (48 engine and desk tests, 8/8 scenarios; 55 desk tests with the memory file); offline scenes 119 pass, failures only those also on main; live LFM3 scenes: clinic 23/23, appliance 28/28, tax-book 23/23, pricing 18/18, itdesk 18/18, pension 20/20, tax desk 9/9"],"next_action":"Merge the risk-band PR once CI passes, then close #56","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0013","timestamp":"2026-11-01T03:39:55Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"9cf6b63b63f5465a812ed5a1acc449b24a8d42495cacb45b404024acc28dacfc","request_id":"17434e7de9a44153a391f0b6061983f8","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0013"} -->

Completed:
- The desk confirms each field by its risk score from decision 0011: picks said in passing, typed values read back, a clear yes held by code from 56, are-you-sure from 76, a person from 91, and 15 more after a mishearing; fills go to Phoenix with their score

Evidence:
- npm run check passes (48 engine and desk tests, 8/8 scenarios; 55 desk tests with the memory file); offline scenes 119 pass, failures only those also on main; live LFM3 scenes: clinic 23/23, appliance 28/28, tax-book 23/23, pricing 18/18, itdesk 18/18, pension 20/20, tax desk 9/9

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Merge the risk-band PR once CI passes, then close #56

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
