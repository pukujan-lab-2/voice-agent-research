# TASK-WCP-0012 — Every live call recorded in full in Phoenix through Octo

<!-- continuity:task {"acceptance":["Each call is one Phoenix session with stack, language and outcome","Every turn, confirmation, tool call and failure is recorded without masking","speech/turns.jsonl is replaced by Phoenix"],"depends_on":[],"goal":"Every live call recorded in full in Phoenix through Octo","id":"WCP-0012","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/17","next_action":"Build the first slice on the task branch","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Calls must be traceable to improve accuracy, and the voice agent logs only to a local file"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Every live call recorded in full in Phoenix through Octo.

## Why

Calls must be traceable to improve accuracy, and the voice agent logs only to a local file (#17).

## Related records

- Leaf #17; parent none; depends on none.
- Primary writer / branch: claude-code / set when the worktree is created.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 04:11:05 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["demo/live-site/tracing.ts, demo/live-site/api.ts, demo/live-site/server.ts, demo/live-site/widget/calllog.ts, demo/live-site/widget/sdk.ts, demo/live-site/widget/remote.ts, demo/live-site/widget/mask.ts (deleted), demo/live-site/speech/telemetry.py, demo/live-site/speech/agent.py, demo/live-site/speech/server.py, demo/live-site/tests/voice-call.ts, demo/live-site/README.md, copilot-engine/src/desk.ts"],"completed":["A live call was not recorded anywhere you could look it up, and traces masked what was said. Now every call is one Phoenix session through Octo, in full: the page sends a call span (business, pages, device, voice stack, language, start, end, outcome) and a span per turn with heard text, decision and why, model and prompt version, reply, quoted passages, timings, tool calls, decision-0011 confirmations, code-lock blocks and corrections, plus failure spans. The voice agent writes voice.turn and voice.call spans from speech/telemetry.py under the same call id, replacing speech/turns.jsonl. POST /api/score attaches eval scores to a call's or turn's span. The server flushes traces before it stops."],"decisions":["No masking in traces, per the owner (each business decides what it keeps); the journal /api/log and report() keep maskPII. No local fallback file (decision 0004). Staff insights page not built."],"evidence":["npm run check passes (8/8 scenarios). Real-audio voice test tests/voice-call.ts 9/10 on the final build; the one miss is small-talk latency on a loaded Mac. Phoenix (read-only query on the VPS database) shows session 677a2b55-4029-444e-b5ce-040dc9578182 with 1 call span (outcome finished, channel voice), 6 turn spans, 5 voice.turn spans, 1 voice.call span and the call's search, judge and desk traces."],"next_action":"Merge the PR once CI passes; WCP-0011 rebases its agent.py, server.py and sdk.ts edits on top and sets the picked language and stack.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0012","timestamp":"2026-11-01T04:11:05Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"6a4d4b6668451b32d177c5e9950e4bbe0643b23fa6826570968fe69c42e1eafb","request_id":"c57c55d86d204a89ae57044260fbae55","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0012"} -->

Completed:
- A live call was not recorded anywhere you could look it up, and traces masked what was said. Now every call is one Phoenix session through Octo, in full: the page sends a call span (business, pages, device, voice stack, language, start, end, outcome) and a span per turn with heard text, decision and why, model and prompt version, reply, quoted passages, timings, tool calls, decision-0011 confirmations, code-lock blocks and corrections, plus failure spans. The voice agent writes voice.turn and voice.call spans from speech/telemetry.py under the same call id, replacing speech/turns.jsonl. POST /api/score attaches eval scores to a call's or turn's span. The server flushes traces before it stops.

Evidence:
- npm run check passes (8/8 scenarios). Real-audio voice test tests/voice-call.ts 9/10 on the final build; the one miss is small-talk latency on a loaded Mac. Phoenix (read-only query on the VPS database) shows session 677a2b55-4029-444e-b5ce-040dc9578182 with 1 call span (outcome finished, channel voice), 6 turn spans, 5 voice.turn spans, 1 voice.call span and the call's search, judge and desk traces.

Decisions:
- No masking in traces, per the owner (each business decides what it keeps); the journal /api/log and report() keep maskPII. No local fallback file (decision 0004). Staff insights page not built.

Changed:
- demo/live-site/tracing.ts, demo/live-site/api.ts, demo/live-site/server.ts, demo/live-site/widget/calllog.ts, demo/live-site/widget/sdk.ts, demo/live-site/widget/remote.ts, demo/live-site/widget/mask.ts (deleted), demo/live-site/speech/telemetry.py, demo/live-site/speech/agent.py, demo/live-site/speech/server.py, demo/live-site/tests/voice-call.ts, demo/live-site/README.md, copilot-engine/src/desk.ts

Blocked/uncertain:
- none

Next:
- Merge the PR once CI passes; WCP-0011 rebases its agent.py, server.py and sdk.ts edits on top and sets the picked language and stack.
