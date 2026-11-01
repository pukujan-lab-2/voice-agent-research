# TASK-WCP-0011 — Voice stacks that can be swapped, with a language picker

<!-- continuity:task {"acceptance":["english-fast and multilingual stacks run and can be picked by owner, business or visitor","The caller picks or says a language before or during a call and the call follows it","Decision 0012 records the stacks"],"depends_on":[],"goal":"Voice stacks that can be swapped, with a language picker","id":"WCP-0011","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/55","next_action":"Connect and benchmark additional models and machine routing","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The voice call only works in English, and the owner wants stacks that people, businesses or the owner can pick"} -->

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
- Primary writer / branch: codex / task/WCP-0011-voice-stacks. Owner requested a live model-testing dashboard and additional choices in the [issue update](https://github.com/Pukujan-lab/voice-agent-research/issues/55#issuecomment-6554005264); Audio, Omni and machine selection remain open.

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

### 2026-11-01 04:21:26 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["demo/live-site/speech/agent.py, demo/live-site/speech/server.py, demo/live-site/widget/sdk.ts, demo/live-site/tests/voice-languages.ts"],"completed":["Merged main (call recording, #62) into the voice-stacks branch; the call record now names the stack, its listener, voice, turn detector and the language the recogniser heard. Whisper gets 60 s per turn."],"decisions":["no new decisions"],"evidence":["npm run check passed after the merge (tests, tsc, knip, ruff, 8/8 scenarios)"],"next_action":"Rerun tests/voice-languages.ts for the Spanish and French live turns, then arm auto-merge on #61.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0011","timestamp":"2026-11-01T04:21:26Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"2c90c663878892f2189ccb655d6c2dc47f9b7c6ef3bffbe9634a676fe029a152","request_id":"eeca67ee600a478abe75ff4fe356da58","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0011"} -->

Completed:
- Merged main (call recording, #62) into the voice-stacks branch; the call record now names the stack, its listener, voice, turn detector and the language the recogniser heard. Whisper gets 60 s per turn.

Evidence:
- npm run check passed after the merge (tests, tsc, knip, ruff, 8/8 scenarios)

Decisions:
- no new decisions

Changed:
- demo/live-site/speech/agent.py, demo/live-site/speech/server.py, demo/live-site/widget/sdk.ts, demo/live-site/tests/voice-languages.ts

Blocked/uncertain:
- none

Next:
- Rerun tests/voice-languages.ts for the Spanish and French live turns, then arm auto-merge on #61.

### 2026-11-01 05:40:01 UTC — codex

<!-- continuity:checkpoint {"agent":"codex","blocked":["LFM3 Audio and Omni adapters, machine switching and comparative voice benchmarks remain unfinished."],"changed":["demo/live-site/app/src, demo/live-site/server.ts, demo/live-site/widget, demo/live-site/tests/voice-choice.test.ts"],"completed":["Added a voice lab and kept the selected language matched to the listening stack."],"decisions":["no new decisions"],"evidence":["Recorded audio call test passed 8 of 8 English Spanish and French checks; npm run check and site build passed."],"next_action":"Connect additional models and host selection, then benchmark each runnable configuration.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0011","timestamp":"2026-11-01T05:40:01Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"3d1d30f43d8d3638f82f13b487979cce44172428f45b25bbbe9ecfe528cbfc31","request_id":"2c2b1b29ab22413f918184699bff1236","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0011"} -->

Completed:
- Added a voice lab and kept the selected language matched to the listening stack.

Evidence:
- Recorded audio call test passed 8 of 8 English Spanish and French checks; npm run check and site build passed.

Decisions:
- no new decisions

Changed:
- demo/live-site/app/src, demo/live-site/server.ts, demo/live-site/widget, demo/live-site/tests/voice-choice.test.ts

Blocked/uncertain:
- LFM3 Audio and Omni adapters, machine switching and comparative voice benchmarks remain unfinished.

Next:
- Connect additional models and host selection, then benchmark each runnable configuration.

### 2026-11-01 05:49:14 UTC — codex

<!-- continuity:checkpoint {"agent":"codex","blocked":["Additional model adapters, host switching and comparative benchmarks remain unfinished."],"changed":["demo/live-site/app/src/lib/copilot.ts, demo/live-site/app/src/pages/VoiceLab.tsx, demo/live-site/speech/stacks.json, demo/live-site/tests/voice-languages.ts, demo/live-site/widget/sdk.ts, docs/decisions/0012-swappable-voice-stacks.md"],"completed":["Added four selectable combinations of the connected listeners and voices, and listed unconnected candidates."],"decisions":["no new decisions"],"evidence":["Recorded audio passed 11 of 11 checks including four combinations and changing from English to Spanish; the build and repository checks passed."],"next_action":"Connect further models and machine routing and compare their performance.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0011","timestamp":"2026-11-01T05:49:14Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"f808af6d1a05f21fcff5f7b08b450f93eea53ffc1343650b82ada5100399747d","request_id":"f643981331544498bbcff60c60250b5e","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0011"} -->

Completed:
- Added four selectable combinations of the connected listeners and voices, and listed unconnected candidates.

Evidence:
- Recorded audio passed 11 of 11 checks including four combinations and changing from English to Spanish; the build and repository checks passed.

Decisions:
- no new decisions

Changed:
- demo/live-site/app/src/lib/copilot.ts, demo/live-site/app/src/pages/VoiceLab.tsx, demo/live-site/speech/stacks.json, demo/live-site/tests/voice-languages.ts, demo/live-site/widget/sdk.ts, docs/decisions/0012-swappable-voice-stacks.md

Blocked/uncertain:
- Additional model adapters, host switching and comparative benchmarks remain unfinished.

Next:
- Connect further models and machine routing and compare their performance.
