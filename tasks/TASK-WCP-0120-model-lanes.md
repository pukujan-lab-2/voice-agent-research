# TASK-WCP-0120 — Model Lanes

<!-- continuity:task {"acceptance": ["Decision 0022 records the common core, the strong, hybrid and small lanes with their own manifests, guards, fixes, eval sets, judge and Octo tables, the voice stack and language folders, and the move to LiveKit Agents tasks for chat and voice", "The decisions index lists 0022", "The decision names the build order as follow-up steps, each with its own issue"], "depends_on": [], "goal": "Record the split into a common core and three model lanes as decision 0022", "id": "WCP-0120", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/162", "next_action": "Merge the pull request; then file step 2, the manifest format and the lane import check", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "One desk runs the same prompt, guards, evals and judge for every model, so a fix for LFM3 also changes what the smart model does (#162)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Record the split into a common core and three model lanes as decision 0022

## Why

One desk runs the same prompt, guards, evals and judge for every model, so a fix for LFM3 also changes what the smart model does (#162)

## Allowed files

- `docs/decisions/0022-model-lanes-on-livekit-tasks.md`, `docs/decisions/README.md`
- this task record

## Human outcome

The owner can pick, configure, test and improve the strong, hybrid and small lanes one at a time, and a fix for one never changes another.

## Scope and boundaries

- In scope: the decision record and its index line.
- Out of scope: moving any code (steps 2 to 9 of the decision, each with its own issue).

## Acceptance criteria

- [x] Decision 0022 records the common core, the strong, hybrid and small lanes with their own manifests, guards, fixes, eval sets, judge and Octo tables, the voice stack and language folders, and the move to LiveKit Agents tasks for chat and voice.
- [x] The decisions index lists 0022.
- [x] The decision names the build order as follow-up steps, each with its own issue.

## Evidence and sources

- Owner direction in the Claude Code session on 2026-11-05: LiveKit tasks, folders in this repo, the strong, hybrid and small lanes, own Octo tables per lane, "Yes, start step 1".

## Related records

- Leaf: #162. Parent: none. Depends on: none.
- Primary writer: Claude Code session for the owner / branch `docs/162-model-lanes` / as of 2026-11-05 PR open.

## Checkpoint log

No checkpoints yet.

### 2026-11-05 17:48:03 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["docs/decisions/0022-model-lanes-on-livekit-tasks.md, docs/decisions/README.md"],"completed":["Decision 0022 records the common core and the strong, hybrid and small lanes, each with its own manifest, guards, fixes, eval sets, judge and Octo tables, plus voice stack and language folders and the move to LiveKit Agents tasks (#162)"],"decisions":["Lanes live in folders in this repo with their own Octo tables in the Chatbots factory workspace; who may reach the strong lane stays as decision 0017 says"],"evidence":["npm run check passes (exit 0; 341 tests, none failing); docs only"],"next_action":"Merge the pull request; then file step 2, the manifest format and the lane import check","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0120","timestamp":"2026-11-05T17:48:03Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"77f8960a2e343670e26a88a89f144aba0f2d843d8bce9621b82fb4e5168a9dd7","request_id":"9d1c59dbaf8847f7957bd438e9181151","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0120"} -->

Completed:
- Decision 0022 records the common core and the strong, hybrid and small lanes, each with its own manifest, guards, fixes, eval sets, judge and Octo tables, plus voice stack and language folders and the move to LiveKit Agents tasks (#162)

Evidence:
- npm run check passes (exit 0; 341 tests, none failing); docs only

Decisions:
- Lanes live in folders in this repo with their own Octo tables in the Chatbots factory workspace; who may reach the strong lane stays as decision 0017 says

Changed:
- docs/decisions/0022-model-lanes-on-livekit-tasks.md, docs/decisions/README.md

Blocked/uncertain:
- none

Next:
- Merge the pull request; then file step 2, the manifest format and the lane import check
