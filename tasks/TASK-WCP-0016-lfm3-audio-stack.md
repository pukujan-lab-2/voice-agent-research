# TASK-WCP-0016 — LFM3-Audio runs a voice call as a voice stack

<!-- continuity:task {"acceptance":["An lfm3-audio stack is in speech/stacks.json, picked like the other stacks (owner VOICE_STACK, visitor, business default) and listed in /voice-lab with only the languages a call test shows it handles","voice_parts() in speech/agent.py and speech/server.py run LFM3-Audio as the listener and the voice of a LiveKit call, and every fill still goes through decision 0011's code lock","A scripted tool-calling test (fill, change an earlier answer, confirm, refuse to submit without a recorded yes) runs on english-fast and on lfm3-audio, and both pass counts are posted on #71","docs/03-lfm3-omni-voice.md carries what the model card and the test showed, and the decisions index is current"],"depends_on":[],"goal":"LFM3-Audio runs a voice call end to end as a voice stack, with a tool-calling test","id":"WCP-0016","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/71","next_action":"Land this record on main, create the task worktree, and start the lfm3-audio downloads once the owner approves them","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The owner chose LFM3-Audio end to end and asked where it is; decision 0012 lists the lfm3-audio stack as a later step, and no test shows whether any model here can call tools (#71)"} -->

- Status: active
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

## Acceptance criteria

- [ ] `lfm3-audio` is in `speech/stacks.json`, pickable by owner, visitor and business default, and shown in `/voice-lab`, with only the languages a call test shows.
- [ ] The LiveKit adapter lets LFM3-Audio hear the caller and speak the reply, and fills still pass the decision 0011 code lock.
- [ ] The tool-calling test's pass counts on `english-fast` and `lfm3-audio` are posted on #71.
- [ ] `docs/03-lfm3-omni-voice.md` is corrected and the decisions index is current.

## Evidence and sources

- [Model card](https://huggingface.co/LiquidAI/LFM3-Audio-2B), [GGUF card](https://huggingface.co/LiquidAI/LFM3-Audio-2B-GGUF) and Liquid's [audio capabilities](https://docs.liquid.ai/lfm/key-concepts/audio-capabilities), read 2026-11-01; the facts are posted on [#71](https://github.com/Pukujan-lab/voice-agent-research/issues/71#issuecomment-6555153288).

## Related records

- Leaf #71; parent none; depends on #61 (merged); related #55, decision 0012, decision 0011, decision 0009.
- Primary writer / branch: claude-code / created by `continuity worktree create WCP-0016`; source issue open as of 2026-11-01.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
