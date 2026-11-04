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

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
