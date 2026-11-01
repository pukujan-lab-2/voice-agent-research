# TASK-WCP-0016 — LFM3-Audio runs a voice call as a voice stack

<!-- continuity:task {"acceptance":["An lfm3-audio stack is in speech/stacks.json, picked like the other stacks (owner VOICE_STACK, visitor, business default) and listed in /voice-lab with only the languages a call test shows it handles","voice_parts() in speech/agent.py and speech/server.py run LFM3-Audio as the listener and the voice of a LiveKit call, and every fill still goes through decision 0011's code lock","A scripted tool-calling test (fill, change an earlier answer, confirm, refuse to submit without a recorded yes) runs on english-fast and on lfm3-audio, and both pass counts are posted on #71","docs/03-lfm3-omni-voice.md carries what the model card and the test showed, and the decisions index is current"],"depends_on":[],"goal":"LFM3-Audio runs a voice call end to end as a voice stack, with a tool-calling test","id":"WCP-0016","next_action":"none; delivered in #77 and #80, merged as 1c76d68 and 64b800b","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"The owner chose LFM3-Audio end to end and asked where it is; decision 0012 lists the lfm3-audio stack as a later step, and no test shows whether any model here can call tools (#71)"} -->

- Status: completed
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

LFM3-Audio runs a voice call end to end as a voice stack, with a tool-calling test.

## Why

The owner chose LFM3-Audio end to end (2026-10-31) and asked on 2026-11-01 where it is and where its tool-calling tests are. Decision 0012 lists an `lfm3-audio` stack as a later step; no code or test exists for it, and no model in this repository has been tested on calling tools (#71).

## Allowed files

- `demo/live-site/speech/` (`stacks.json`, `agent.py`, `server.py`, `requirements.txt` if a package is needed).
- `demo/live-site/app/src/pages/VoiceLab.tsx` and any file the voice lab list reads.
- `demo/live-site/server.ts`, `demo/live-site/api.ts` only where the stack has to reach the model for `/api/desk`.
- A new tool-calling test under `demo/live-site/tests/` or `copilot-engine/tests/`.
- `docs/03-lfm3-omni-voice.md`, `docs/decisions/`, `PROJECT.md` if it lists the stacks.

## Human outcome

The owner can pick LFM3-Audio for a call, like any other stack, and the repository finally has a number for how well a small voice model calls tools, measured the same way on the current stack and the new one.

## Scope and boundaries

- In scope: reading how LFM3-Audio runs on this M1 with 8 GB; the stack; its LiveKit adapter; the tool-calling test on `english-fast` and `lfm3-audio`; the doc correction.
- Out of scope: other stacks, model comparisons beyond the one tool-calling test, the staff insights page (#17), machine routing.
- Dependencies/uncertainty: weights of about 1.4 GB need the owner's approval before download. If a call cannot run on this Mac, the findings, test results and limits are merged and posted on #71 with the next action.

## Revised scope (2026-11-01, after the first merge, #77)

The owner asked, after PR #77 merged, that voice models be swapped and not run all at once ("i hope we dont run them all at once pls use them with swap set them up with swap", relayed to #71; #71 was reopened). This task now also covers: the speech server keeps only the resident stack's models and swaps on demand, the agent asks for the swap before it greets, a swap test on this Mac, and decision 0014. Allowed files gain `demo/live-site/speech/agent.py` and `server.py` (already listed) and `docs/decisions/0014-*`.

## Acceptance criteria

- [x] Swap (added 2026-11-01): a call that picks a different stack unloads the models the new stack does not use and loads its own; a swap test on this Mac shows the resident set and memory after each step; decision 0014 records it.

- [x] `lfm3-audio` is in `speech/stacks.json`, pickable by owner, visitor and business default, and shown in `/voice-lab`, with only the languages a call test shows.
- [x] The LiveKit adapter lets LFM3-Audio hear the caller and speak the reply, and fills still pass the decision 0011 code lock.
- [x] The tool-calling test's pass counts on `english-fast` and `lfm3-audio` are posted on #71.
- [x] `docs/03-lfm3-omni-voice.md` is corrected and the decisions index is current.

## Evidence and sources

- [Model card](https://huggingface.co/LiquidAI/LFM3-Audio-2B), [GGUF card](https://huggingface.co/LiquidAI/LFM3-Audio-2B-GGUF) and Liquid's [audio capabilities](https://docs.liquid.ai/lfm/key-concepts/audio-capabilities), read 2026-11-01; the facts are posted on [#71](https://github.com/Pukujan-lab/voice-agent-research/issues/71#issuecomment-6555153288).

- Results, 2026-11-01, all posted on #71: `tests/voice-tools.ts` on `lfm3-audio` 6/8 tool calls and 10/10 outcomes, on `english-fast` 7/8 and 9/10 (one run each, `english-fast` varied between runs); one real LiveKit call on `lfm3-audio` completed (recognition about 1.0 s a turn, voice first audio 0.2 to 0.8 s); a Spanish and a French turn did not hold, so the stack lists English only. Decision 0013 records the choices.
- Approved downloads: LFM3-Audio-2B Q4_K_M (1,099.6 MB), its Q8_0 audio projector (303.8 MB) and llama.cpp b12031 (16 MB), approved by the owner through the parent session on 2026-11-01.

## Related records

- Leaf #71; parent none; depends on #61 (merged); related #55, decision 0012, decision 0011, decision 0009.
- Primary writer / branch: claude-code / created by `continuity worktree create WCP-0016`; source issue open as of 2026-11-01.

## Delivery

- Delivered in pull request #77, merged as `1c76d68` on 2026-11-01 09:16 UTC from pushed head `a780eec` (the stack, the tool-calling test, decision 0013 and the voice notes), and in pull request #80, merged as `64b800b` at 09:29 UTC from pushed head `1246cca` (models swapped, decision 0014). Required checks on both: `gates`, the release-train check and the close job passed. #71 closed on the second merge.
- Results are on #71: tool calls 6 of 8 and outcomes 10 of 10 on `lfm3-audio`, 7 of 8 and 9 of 10 on `english-fast` (one run each); one real LiveKit call on `lfm3-audio`; English only on that stack; the swap test through five stacks.
- Not delivered, for their own issues if the owner wants them: the other languages on LFM3-Audio's hearing and voice with the LFM3 text model deciding, LFM3-Omni (notes on #71), and 4-bit against BF16 accuracy.
- Primary writer / branches: claude-code / `task/WCP-0016-lfm3-audio-stack` and `task/WCP-0016-swap-models`; source issue closed as of 2026-11-01.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 07:59:39 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["model files not downloaded: LFM3-Audio-2B Q4_K_M 1.10 GB, audio projector 0.30 GB and llama.cpp b12031 16 MB wait for the owner's approval (asked on 2026-11-01)"],"changed":["demo/live-site/speech/{stacks.json,server.py,agent.py,requirements.txt}, demo/live-site/{api.ts,server.ts,widget/remote.ts,widget/sdk.ts,tests/voice-tools.ts}, demo/live-site/app/src/{lib/copilot.ts,pages/VoiceLab.tsx}, copilot-engine/{src/desk.ts,tests/desk.test.ts,ledger.jsonl}"],"completed":["The owner has no LFM3-Audio voice stack to pick and no tool-calling test for any model. The lfm3-audio stack is now written (stacks.json, speech/server.py, speech/agent.py, the desk model route in api.ts, the voice lab) and tests/voice-tools.ts scripts the spoken tool-calling test; neither has run yet because the model files (1.4 GB) wait for the owner's approval."],"decisions":["no new decision yet; whether decision 0013 is needed waits for the test results"],"evidence":["npm run check passed on the branch (50 engine tests, 8 of 8 scenarios, ruff, tsc); the app type-checks; the new engine test shows the LFM3-Audio request ends its system prompt with 'List of tools:' only when tools are offered. Nothing has run against the model."],"next_action":"After the owner approves the download: fetch the files into speech/models/lfm3-audio, start the speech server on a spare port, run tests/voice-tools.ts on english-fast and lfm3-audio, and post the pass counts on #71","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0016","timestamp":"2026-11-01T07:59:39Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"4d7d686f4cf5156d140b9cb66d980588d66796b746f17bfa20fa98240c9e4a6d","request_id":"f8879f92f41c4498998cde9e0d855420","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0016"} -->

Completed:
- The owner has no LFM3-Audio voice stack to pick and no tool-calling test for any model. The lfm3-audio stack is now written (stacks.json, speech/server.py, speech/agent.py, the desk model route in api.ts, the voice lab) and tests/voice-tools.ts scripts the spoken tool-calling test; neither has run yet because the model files (1.4 GB) wait for the owner's approval.

Evidence:
- npm run check passed on the branch (50 engine tests, 8 of 8 scenarios, ruff, tsc); the app type-checks; the new engine test shows the LFM3-Audio request ends its system prompt with 'List of tools:' only when tools are offered. Nothing has run against the model.

Decisions:
- no new decision yet; whether decision 0013 is needed waits for the test results

Changed:
- demo/live-site/speech/{stacks.json,server.py,agent.py,requirements.txt}, demo/live-site/{api.ts,server.ts,widget/remote.ts,widget/sdk.ts,tests/voice-tools.ts}, demo/live-site/app/src/{lib/copilot.ts,pages/VoiceLab.tsx}, copilot-engine/{src/desk.ts,tests/desk.test.ts,ledger.jsonl}

Blocked/uncertain:
- model files not downloaded: LFM3-Audio-2B Q4_K_M 1.10 GB, audio projector 0.30 GB and llama.cpp b12031 16 MB wait for the owner's approval (asked on 2026-11-01)

Next:
- After the owner approves the download: fetch the files into speech/models/lfm3-audio, start the speech server on a spare port, run tests/voice-tools.ts on english-fast and lfm3-audio, and post the pass counts on #71

### 2026-11-01 08:03:26 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["lfm3-audio model files (about 1.4 GB) wait for the owner's approval"],"changed":["demo/live-site/tests/voice-tools.ts"],"completed":["The tool-calling test had three spoken lines that did not test what they claimed, so its first run scored lower than the model deserved. The lines are rewritten and the frozen script ran once on english-fast: the model made the right call on 7 of 8 turns and the form ended right on 9 of 10 checks."],"decisions":["no new decisions"],"evidence":["tests/voice-tools.ts english-fast, 2026-11-01: tool calls 7/8, outcomes 9/10 (Parakeet to LFM3-1.7B Q4_K_M on the Windows test PC, temperature 0); an earlier draft scored 5/8 and 7/10, and a second draft 7/8 and 8/10, so results vary run to run. npm run check passed before the rewrite. lfm3-audio has not run."],"next_action":"After the owner approves the download, fetch the model files, run tests/voice-tools.ts on lfm3-audio, test the languages, write the docs and arm auto-merge on the pull request","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0016","timestamp":"2026-11-01T08:03:26Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"e3903af26869a2f182238575dfe6a858cb610f270f544687799c81066244d6cf","request_id":"f5ba88193bc042cbbed282a3527f2191","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0016"} -->

Completed:
- The tool-calling test had three spoken lines that did not test what they claimed, so its first run scored lower than the model deserved. The lines are rewritten and the frozen script ran once on english-fast: the model made the right call on 7 of 8 turns and the form ended right on 9 of 10 checks.

Evidence:
- tests/voice-tools.ts english-fast, 2026-11-01: tool calls 7/8, outcomes 9/10 (Parakeet to LFM3-1.7B Q4_K_M on the Windows test PC, temperature 0); an earlier draft scored 5/8 and 7/10, and a second draft 7/8 and 8/10, so results vary run to run. npm run check passed before the rewrite. lfm3-audio has not run.

Decisions:
- no new decisions

Changed:
- demo/live-site/tests/voice-tools.ts

Blocked/uncertain:
- lfm3-audio model files (about 1.4 GB) wait for the owner's approval

Next:
- After the owner approves the download, fetch the model files, run tests/voice-tools.ts on lfm3-audio, test the languages, write the docs and arm auto-merge on the pull request

### 2026-11-01 08:15:37 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["none"],"changed":["docs/03-lfm3-omni-voice.md, docs/decisions/{0012,0013,README}.md, PROJECT.md, tasks/TASK-WCP-0016-lfm3-audio-stack.md, demo/live-site/tests/voice-tools.ts, copilot-engine/ledger.jsonl"],"completed":["The owner could not pick LFM3-Audio for a call and no test showed whether any model here can call tools. The lfm3-audio stack now runs a real LiveKit call on this Mac in English, the tool-calling test has results for both english-fast and lfm3-audio, and decision 0013 and the voice notes record what was found."],"decisions":["0013: the lfm3-audio stack is one model on llama.cpp (Q4_K_M), hears per turn, sends the desk's tool calls to the same model, and is listed in English only"],"evidence":["tests/voice-tools.ts, one run each on 2026-11-01: lfm3-audio tool calls 6/8, outcomes 10/10; english-fast 7/8 and 9/10. One real LiveKit call on lfm3-audio: greeting, two heard lines and two replies, recognition about 1.0 s a turn, voice first audio 0.2 to 0.8 s, model server 1.49 GB. Round trip of speech through the model in English, Spanish, French, Italian, Portuguese and Chinese at 0.94 to 1.00; a Spanish and a French turn did not hold, so the stack lists English only. npm run check passed after merging main (50 engine tests, 8 of 8 scenarios, ruff, tsc); the app type-checks."],"next_action":"Wait for the required checks on the pull request, confirm the merge and that issue 71 closed, then remove the worktree with continuity worktree remove WCP-0016","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0016","timestamp":"2026-11-01T08:15:37Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"d9e54652fdb3b8aae151a2a13b790e6c69f395a7f8ea9e7a2b6f3f199ee85cee","request_id":"12485cd417964ce9a4b5a0e314494241","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0016"} -->

Completed:
- The owner could not pick LFM3-Audio for a call and no test showed whether any model here can call tools. The lfm3-audio stack now runs a real LiveKit call on this Mac in English, the tool-calling test has results for both english-fast and lfm3-audio, and decision 0013 and the voice notes record what was found.

Evidence:
- tests/voice-tools.ts, one run each on 2026-11-01: lfm3-audio tool calls 6/8, outcomes 10/10; english-fast 7/8 and 9/10. One real LiveKit call on lfm3-audio: greeting, two heard lines and two replies, recognition about 1.0 s a turn, voice first audio 0.2 to 0.8 s, model server 1.49 GB. Round trip of speech through the model in English, Spanish, French, Italian, Portuguese and Chinese at 0.94 to 1.00; a Spanish and a French turn did not hold, so the stack lists English only. npm run check passed after merging main (50 engine tests, 8 of 8 scenarios, ruff, tsc); the app type-checks.

Decisions:
- 0013: the lfm3-audio stack is one model on llama.cpp (Q4_K_M), hears per turn, sends the desk's tool calls to the same model, and is listed in English only

Changed:
- docs/03-lfm3-omni-voice.md, docs/decisions/{0012,0013,README}.md, PROJECT.md, tasks/TASK-WCP-0016-lfm3-audio-stack.md, demo/live-site/tests/voice-tools.ts, copilot-engine/ledger.jsonl

Blocked/uncertain:
- none

Next:
- Wait for the required checks on the pull request, confirm the merge and that issue 71 closed, then remove the worktree with continuity worktree remove WCP-0016

### 2026-11-01 08:28:18 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["none"],"changed":["demo/live-site/speech/{server.py,agent.py}, docs/decisions/{0012,0013,0014,README}.md, docs/03-lfm3-omni-voice.md, tasks/TASK-WCP-0016-lfm3-audio-stack.md, copilot-engine/ledger.jsonl"],"completed":["Voice models ran all at once on an 8 GB Mac that was already swapping, against the owner's direction to swap them. The speech server now keeps only the stack in use resident, the agent asks for the swap before it greets, and decision 0014 records how it works and what it cost."],"decisions":["0014: only the stack in use is resident; the agent asks for the swap before it greets; the default stack is loaded at start; a swap waits for requests still running; nothing unloads when a call ends"],"evidence":["Swap test on this Mac, one pass through english-fast, lfm3-audio, english-fast, multilingual, lfm3-audio: the resident set was exactly one stack's models after every step; the server's footprint went 1.78 GB, 0.31 GB, 1.77 GB, 3.20 GB, 1.11 GB; Whisper's graphics memory fell from 1,546 MB to 3 MB once unloaded through its module; a swap asked during an 18 s reply waited for it and the reply arrived complete. One real LiveKit call started with english-fast resident and swapped to lfm3-audio in 3.3 s before its greeting. npm run check passed (50 engine tests, 8 of 8 scenarios, ruff, tsc)."],"next_action":"Wait for the required checks on the pull request, confirm the merge and that issue 71 closed, then remove the worktree with continuity worktree remove WCP-0016","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0016","timestamp":"2026-11-01T08:28:18Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"bdaaf3c51b53ac0ed31ca1a020a06c0b204bbfc209a7e527abf19ef3ef366588","request_id":"cb95e11c815a4b35ba4c2f35d94721d9","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0016"} -->

Completed:
- Voice models ran all at once on an 8 GB Mac that was already swapping, against the owner's direction to swap them. The speech server now keeps only the stack in use resident, the agent asks for the swap before it greets, and decision 0014 records how it works and what it cost.

Evidence:
- Swap test on this Mac, one pass through english-fast, lfm3-audio, english-fast, multilingual, lfm3-audio: the resident set was exactly one stack's models after every step; the server's footprint went 1.78 GB, 0.31 GB, 1.77 GB, 3.20 GB, 1.11 GB; Whisper's graphics memory fell from 1,546 MB to 3 MB once unloaded through its module; a swap asked during an 18 s reply waited for it and the reply arrived complete. One real LiveKit call started with english-fast resident and swapped to lfm3-audio in 3.3 s before its greeting. npm run check passed (50 engine tests, 8 of 8 scenarios, ruff, tsc).

Decisions:
- 0014: only the stack in use is resident; the agent asks for the swap before it greets; the default stack is loaded at start; a swap waits for requests still running; nothing unloads when a call ends

Changed:
- demo/live-site/speech/{server.py,agent.py}, docs/decisions/{0012,0013,0014,README}.md, docs/03-lfm3-omni-voice.md, tasks/TASK-WCP-0016-lfm3-audio-stack.md, copilot-engine/ledger.jsonl

Blocked/uncertain:
- none

Next:
- Wait for the required checks on the pull request, confirm the merge and that issue 71 closed, then remove the worktree with continuity worktree remove WCP-0016

### 2026-11-01 08:30:17 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":["none"],"changed":["tasks/TASK-WCP-0016-lfm3-audio-stack.md, copilot-engine/ledger.jsonl"],"completed":["The LFM3-Audio task was finished but its record still said active, which blocks removing its worktree. The record now says both pull requests merged (#77 as 1c76d68, #80 as 64b800b), #71 closed, and what was left for their own issues."],"decisions":["no new decision"],"evidence":["Observed on the merges: gates, the release-train check and the close job passed on both pull requests; main fetched and contains speech/server.py with Stacks.use, tests/voice-tools.ts and decisions 0013 and 0014. npm run check passed on this branch."],"next_action":"After this record merges, run continuity worktree remove WCP-0016","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0016","timestamp":"2026-11-01T08:30:17Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"c2cb71c7a08926b988f600cdda3d828f38fb24c864040ffa1724372903d86e52","request_id":"c17caa82517e4757be9d6a540eb32cbe","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0016"} -->

Completed:
- The LFM3-Audio task was finished but its record still said active, which blocks removing its worktree. The record now says both pull requests merged (#77 as 1c76d68, #80 as 64b800b), #71 closed, and what was left for their own issues.

Evidence:
- Observed on the merges: gates, the release-train check and the close job passed on both pull requests; main fetched and contains speech/server.py with Stacks.use, tests/voice-tools.ts and decisions 0013 and 0014. npm run check passed on this branch.

Decisions:
- no new decision

Changed:
- tasks/TASK-WCP-0016-lfm3-audio-stack.md, copilot-engine/ledger.jsonl

Blocked/uncertain:
- none

Next:
- After this record merges, run continuity worktree remove WCP-0016

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
