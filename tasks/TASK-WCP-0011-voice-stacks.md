# TASK-WCP-0011 — Voice stacks that can be swapped, with a language picker

<!-- continuity:task {"acceptance":["english-fast and multilingual stacks run and can be picked by owner, business or visitor","The caller picks or says a language before or during a call and the call follows it","Decision 0012 records the stacks"],"depends_on":[],"goal":"Voice stacks that can be swapped, with a language picker","id":"WCP-0011","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/55","next_action":"Build the first slice on the task branch","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The voice call only works in English, and the owner wants stacks that people, businesses or the owner can pick"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Voice stacks that can be swapped, with a language picker.

## Why

The voice call only works in English, and the owner wants stacks that people, businesses or the owner can pick (#55).

## Related records

- Leaf #55; parent none; depends on none.
- Primary writer / branch: claude-code / set when the worktree is created.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 04:02:15 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["demo/live-site/speech, demo/live-site/server.ts, demo/live-site/widget, demo/live-site/tests/voice-languages.ts, demo/live-site/app/src, docs/decisions/0012-swappable-voice-stacks.md, docs/03-lfm3-omni-voice.md, PROJECT.md"],"completed":["The voice call only worked in English; it now runs on a swappable voice stack (english-fast or multilingual) picked by owner, business or visitor, with a language picker that passes the caller's language to speech to text, the turn detector, the voice and LFM3. Decision 0012 records it."],"decisions":["0012: swappable voice stacks; Japanese left out until Kokoro gets the misaki phonemizer."],"evidence":["npm run check passed after rebasing on #60 (41 unit tests, 8/8 scenarios); site build and copilot contract check passed; Whisper turbo transcribed a Spanish sentence word for word and detected es; live call: English heard as en on english-fast, picking Spanish moved the call to multilingual, greeting spoken in Spanish by Kokoro; the Spanish and French turns are still running on an overloaded laptop."],"next_action":"Finish the end-to-end Spanish and French turns (tests/voice-languages.ts), then arm auto-merge.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0011","timestamp":"2026-11-01T04:02:15Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"c26a6964853739471bba9edff6f4ae2c3dcdeac2dc771d6777e36e2c45483ded","request_id":"81b75e941f474641b813df360cf69514","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0011"} -->

Completed:
- The voice call only worked in English; it now runs on a swappable voice stack (english-fast or multilingual) picked by owner, business or visitor, with a language picker that passes the caller's language to speech to text, the turn detector, the voice and LFM3. Decision 0012 records it.

Evidence:
- npm run check passed after rebasing on #60 (41 unit tests, 8/8 scenarios); site build and copilot contract check passed; Whisper turbo transcribed a Spanish sentence word for word and detected es; live call: English heard as en on english-fast, picking Spanish moved the call to multilingual, greeting spoken in Spanish by Kokoro; the Spanish and French turns are still running on an overloaded laptop.

Decisions:
- 0012: swappable voice stacks; Japanese left out until Kokoro gets the misaki phonemizer.

Changed:
- demo/live-site/speech, demo/live-site/server.ts, demo/live-site/widget, demo/live-site/tests/voice-languages.ts, demo/live-site/app/src, docs/decisions/0012-swappable-voice-stacks.md, docs/03-lfm3-omni-voice.md, PROJECT.md

Blocked/uncertain:
- none

Next:
- Finish the end-to-end Spanish and French turns (tests/voice-languages.ts), then arm auto-merge.
