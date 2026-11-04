# TASK-WCP-0110 — Call Audio

<!-- continuity:task {"acceptance":["Each voice call's audio is recorded from the LiveKit room and stored encrypted with that call's key","A business can turn recording off in its config; it is on by default","A plain-code test: a recorded call's audio in storage is ciphertext (playback through a valid grant is tested in #131)"],"depends_on":["WCP-0108"],"goal":"Record each voice call's audio and store it locked with the call's key","id":"WCP-0110","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/130","next_action":"open the pull request with Closes #130, confirm CI is green and arm auto-merge","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Voice calls keep only text, though the owner's direction is to record every call in full; decision 0021 settles that audio is locked like transcripts and played back only through a grant (#130)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: WCP-0108 (#128, merged)

## Goal

Record each voice call's audio and store it locked with the call's key

## Why

Voice calls keep only text, though the owner's direction is to record every call in full; decision 0021 settles that audio is locked like transcripts and played back only through a grant (#130)

## Allowed files

- copilot-engine/src/call-audio.ts
- copilot-engine/src/call-vault.ts
- copilot-engine/src/site-config.ts
- copilot-engine/tests/call-vault.test.ts
- copilot-engine/tests/site-config.test.ts
- demo/live-site/api.ts
- demo/live-site/server.ts
- demo/live-site/widget/sdk.ts
- demo/live-site/speech/agent.py
- demo/live-site/speech/recording.py
- demo/live-site/speech/tests/test_recording.py
- demo/live-site/tests/own-workspace.test.ts
- deploy/README.md
- deploy/agent.Dockerfile
- deploy/docker-compose.agent.yml
- tasks/TASK-WCP-0110-call-audio.md

## Human outcome

Every voice call is kept in full, as the owner directed: the caller and the copilot, each on its own channel, locked by the call's key in the business's own workspace. A business that doesn't want recordings turns them off in its config.

## Scope and boundaries

- In scope: recording in the voice agent (LiveKit Agents' session recorder), the signed upload to the site, the locked store, the `recording.audio` switch, retention sweep of recordings, tests.
- Out of scope: playback, which is only through a grant (#131); caller consent wording (owner and counsel); transcription quality.
- Dependencies/uncertainty: no business is registered in the live registry yet, so no live call is recorded until one is.

## Acceptance criteria

- [ ] Each voice call's audio is recorded from the LiveKit room and stored encrypted with that call's key
- [ ] A business can turn recording off in its config; it is on by default
- [ ] A plain-code test: a recorded call's audio in storage is ciphertext (playback through a valid grant is tested in #131)

## Evidence and sources

Starting revision 2f5cc08 (main after #129). LiveKit Agents 1.8.8 `AgentSession.start(record=...)` and `voice/recorder_io` (read in the deployed agent image). Tests: `copilot-engine/tests/call-vault.test.ts`, `demo/live-site/tests/own-workspace.test.ts`, `demo/live-site/speech/tests/test_recording.py`.

## Reproduction details (only when needed)

Not needed.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): leaf #130; parent #121; depends on #128 (merged)
- Primary writer / branch / source issue revision / as-of status: Claude Code side session of local_a2ffa57e / task/WCP-0110-call-audio / #130 as filed 2026-11-04 plus the scope comment of 2026-11-04 / active
- Related PR/CI evidence and push receipt (request ID / SHA): pending

## Checkpoint log

No checkpoints yet.

### 2026-11-04 23:28:22 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/call-audio.ts, call-vault.ts, site-config.ts, demo/live-site/api.ts, server.ts, widget/sdk.ts, speech/agent.py, speech/recording.py, deploy agent compose and Dockerfile, tests"],"completed":["Voice calls are recorded by the agent and stored locked with the call's key in the business's workspace; recording.audio switch in config"],"decisions":["Record with LiveKit Agents' own session recorder, not Egress; the site names recorded rooms call-<id>.<business>; playback waits for grants (#131)"],"evidence":["npm run check passes; own-workspace test shows a signed recording stored as ciphertext in the clinic's workspace and opened only for it, bad signatures refused, recording off keeps nothing"],"next_action":"Open the PR with Closes #130 and arm auto-merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0110","timestamp":"2026-11-04T23:28:22Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"9c07740ccf3c65edc6c5d4780b6d9c4feefbd0b815bdd95f6079b81bc2a13449","request_id":"019b9972f78d4510ad7f2b1d021147cc","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0110"} -->

Completed:
- Voice calls are recorded by the agent and stored locked with the call's key in the business's workspace; recording.audio switch in config

Evidence:
- npm run check passes; own-workspace test shows a signed recording stored as ciphertext in the clinic's workspace and opened only for it, bad signatures refused, recording off keeps nothing

Decisions:
- Record with LiveKit Agents' own session recorder, not Egress; the site names recorded rooms call-<id>.<business>; playback waits for grants (#131)

Changed:
- copilot-engine/src/call-audio.ts, call-vault.ts, site-config.ts, demo/live-site/api.ts, server.ts, widget/sdk.ts, speech/agent.py, speech/recording.py, deploy agent compose and Dockerfile, tests

Blocked/uncertain:
- none

Next:
- Open the PR with Closes #130 and arm auto-merge

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
