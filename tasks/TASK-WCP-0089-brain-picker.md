# TASK-WCP-0089 — Brain Picker

<!-- continuity:task {"acceptance":["A visitor's /api/brain/options lists only the local model; an owner-cookie or development-host request also lists the smart options","The server refuses a smart desk pick without scope, whatever the page sends","A pick rides on the request, is recorded on the desk span, and changes which model answers (stub provider)","The owner signs in on the page; the token is typed, never in page source, a URL or localStorage","No secret in any page or response"],"depends_on":[],"goal":"A Brain picker beside the voice and language pickers, with an owner sign-in on the page","id":"WCP-0089","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/97","next_action":"implement the server options endpoint, then the widget picker","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The owner asked where the llm model is chosen; smart models were reachable only by curl (#97, parent #77)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

A Brain picker beside the voice and language pickers, with an owner sign-in on the page

## Why

The owner asked where the llm model is chosen; smart models were reachable only by curl (#97, parent #77)

## Allowed files

- `demo/live-site/api.ts`
- `demo/live-site/widget/sdk.ts`
- `demo/live-site/widget/remote.ts`
- `demo/live-site/app/src/lib/copilot.ts`
- `demo/live-site/app/src/components/copilot/CopilotWidget.tsx`
- `demo/live-site/app/src/styles/copilot-view.css`
- `demo/live-site/tests/brain-picker.test.ts`
- `demo/live-site/tests/smart-desk.test.ts`
- `deploy/README.md`
- `PROJECT.md`
- `tasks/TASK-WCP-0089-brain-picker.md`

## Human outcome

The owner sees and changes which model answers, on the page, without curl; a visitor never can.

## Scope and boundaries

- In scope: a `/api/brain/options` endpoint that builds the list from the `desk` slot per request scope, the pick riding on `/api/desk`, the Brain picker and owner sign-in in the widget, tests, deploy README and PROJECT status row.
- Out of scope: new providers, the voice agent's own model choice, the slot file format (#78, merged).
- Dependencies/uncertainty: depends on #78, #79, #89 (all merged).

## Acceptance criteria

- [x] A visitor's `/api/brain/options` lists only the local model; an owner-cookie or development-host request also lists the smart options
- [x] The server refuses a smart desk pick without scope, whatever the page sends
- [x] A pick rides on the request, is recorded on the desk span, and changes which model answers (stub provider)
- [x] The owner signs in on the page; the token is typed, never in page source, a URL or localStorage
- [x] No secret in any page or response

## Evidence and sources

`demo/live-site/tests/brain-picker.test.ts`: 8 tests, all pass (`node --test`), one per acceptance check against stubbed models. `tests/smart-desk.test.ts`: 20 pass (the old escalation contract unchanged). Check steps pass with only pre-existing machine findings identical to pristine `main`: pglite not installed (one typecheck error, one stores test), replay 5 fail / 2 skip with `gate: ok` (same on main), lint and typecheck clean on every changed file.

## Related records

- Leaf issue #97; parent #77; depends on #78, #79, #89 (all merged).
- Primary writer / branch: workbuddy / `task/WCP-0089-brain-picker`; issue verified open as of 2026-11-02.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

### 2026-11-02 03:16:27 UTC — workbuddy

<!-- continuity:checkpoint {"agent":"workbuddy","blocked":[],"changed":["none"],"completed":["The Brain picker is on the page beside the voice and language pickers: POST /api/brain/options builds the list from the desk slot per request scope, the pick rides on /api/desk with the server enforcing scope, and the owner signs in on the page (typed token, only the cookie kept). A visitor sees the local model only"],"decisions":["no new decisions"],"evidence":["8 new brain-picker tests pass and 20 smart-desk tests pass; lint and typecheck clean on changed files; check steps show only pre-existing machine findings identical to main (pglite, replay gate ok)"],"next_action":"Push the branch, open the pull request with Refs #97, and check the picker at phone and desktop widths","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0089","timestamp":"2026-11-02T03:16:27Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"22c1cc218fec19c137da559f9bb39efe26050f13a9fe056424e67b63af517041","request_id":"a10fecbb098246cda0de85f8320556ac","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0089"} -->

Completed:
- The Brain picker is on the page beside the voice and language pickers: POST /api/brain/options builds the list from the desk slot per request scope, the pick rides on /api/desk with the server enforcing scope, and the owner signs in on the page (typed token, only the cookie kept). A visitor sees the local model only

Evidence:
- 8 new brain-picker tests pass and 20 smart-desk tests pass; lint and typecheck clean on changed files; check steps show only pre-existing machine findings identical to main (pglite, replay gate ok)

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Push the branch, open the pull request with Refs #97, and check the picker at phone and desktop widths

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
