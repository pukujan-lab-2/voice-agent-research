# 0022. A common core and three model lanes, each tested on its own, on LiveKit Agents tasks

**Status:** Accepted · **Date:** 2026-11-05 · **Issue:** [#162](https://github.com/pukujan-lab-2/voice-agent-research/issues/162) · Builds on [0002](0002-voice-livekit-agents.md), [0012](0012-swappable-voice-stacks.md), [0014](0014-voice-models-are-swapped.md), [0017](0017-smart-model-slots-for-development.md) and [0021](0021-adopters-own-a-workspace.md)

## Decision

The copilot is split into a common core and three model lanes. Each lane has its own configuration, guards, fixes, eval sets, judge and improvement loop, and is tested on its own. A fix made for one lane never runs in another.

| Lane | What answers | What it is for |
|---|---|---|
| `strong` | a strong model on every turn | the lane that already works, with its own eval sets, judge and improvement loop |
| `hybrid` | the small model, with hard turns sent to the strong model | scaling |
| `small` | the small model (LFM3) alone | configured and improved over time |

The lane is called `small`, never "weak" (the owner's naming).

Everything lives in folders in this repository, one manifest per part:

```
agent/
  common/               shared by every lane: the product rules, value parsing, records,
                        page search, and each form's steps as data
  lanes/
    strong/  hybrid/  small/
                        manifest, prompt, guards/, fixes/, evals/, judge, tests/
  voice/stacks/<stack>/ one manifest per voice stack (what listens, detects turns, speaks, which languages)
  languages/<code>/     one manifest per language (speech codes, voice, fixed sentences)
```

What this settles:

1. **The common core holds only what every lane must do.** These are the product rules no lane can turn off: never submit, verify the caller before showing records, offer only from the business's list, say it's an AI ([0020](0020-honest-that-it-is-an-ai.md)), and quote the business's pages word for word. Value parsing, records, page search and the form steps live there too.
2. **A lane imports the common core and nothing from another lane.** `npm run check` fails on an import from one lane into another, and on one from one voice stack into another.
3. **A lane's manifest names everything the lane uses:** its models, prompt, tools, limits, which guards and fixes are on, its eval sets and judge, its pass bar, the embedder and reranker its searches use, and for `hybrid` where a hard turn goes.
4. **Config picks the lane, the voice stack and the language per business**, the way a plan picks the lane in [0021](0021-adopters-own-a-workspace.md). Only what the config picks is loaded ([0014](0014-voice-models-are-swapped.md)).
5. **Each lane is tested against its own eval sets, judge and pass bar.** Lanes are not compared with each other.
6. **Each lane improves on its own.** A bad turn is flagged under the lane it happened in, becomes a replay case in that lane's set, and its issue names that lane.
7. **Each lane has its own Octo tables** in the "Chatbots factory" workspace, named by lane (for example `small_flagged_turns`, `small_replay_cases`), for flagged turns, replay cases, eval sets and the judge setting. A business's pages and passages, its call records and its config stay shared, since every lane quotes the same site.
8. **Chat and voice run on LiveKit Agents tasks.** Voice already runs on LiveKit Agents ([0002](0002-voice-livekit-agents.md)). Chat moves to the same worker through a text-only room, so each rule is written once, and the caller check and records sit on the server where a browser cannot skip them. The TypeScript desk and form engine are deleted once both channels pass their lanes' tests.

What does not change: who may reach the `strong` lane stays as [0017](0017-smart-model-slots-for-development.md) says (a smart model on every turn only for a development host or the owner's token), and the model name allow-list still rejects Claude, Gemma and `openrouter/free` everywhere.

## Why

Today one desk (`copilot-engine/src/desk.ts`) holds one prompt, one set of guards, one eval set and one judge for every model. Its LFM3 workarounds (tool calls written as text, the reminder nudge, the short-context retry) also run when the smart model answers, and `flagged_turns` and `replay_cases` have no lane column, so a small-model failure becomes a case for every model. The owner wants common code apart from code made for one model, so each lane can be picked, configured and tested on its own: a strong lane that already works, a hybrid lane for scaling, and a small lane tuned over time (2026-11-05). The owner picked LiveKit Agents tasks over LangGraph for the conversation engine, since voice already runs on LiveKit, and folders in this repository with their own Octo tables over separate repositories and workspaces.

## Build order

Each step is its own issue and pull request.

1. Record this decision (#162).
2. The manifest format, the loader, and the check that stops one lane or stack importing another.
3. Move the voice stacks and languages out of `demo/live-site/speech/stacks.json` into their folders; calls work as before.
4. Write each form's steps as data that Python can read.
5. Move the caller check, records, quote matching and the closed action list to the server.
6. Build the three lanes on LiveKit tasks, one task per form step with only that step's tools. Each lane gets only the fixes it needs, and its own eval sets, judge and Octo tables.
7. Switch voice to the lanes, with an on/off setting per business. The current desk stays as the fallback until each lane meets its pass bar.
8. Move chat onto the same worker, then delete the TypeScript desk and form engine.
9. Make each lane's tests a release gate, and deploy through GitHub and Komodo.

## Consequences

- Until step 8 lands, the current desk keeps serving chat and voice unchanged.
- Chat needs the voice worker awake. Today the worker sleeps after 10 idle minutes (#117), so the first chat after a quiet spell waits for it to wake.
- Every chat becomes a process on the VPS, and no per-session memory figure is published for LiveKit Agents.
- LiveKit Agents is pinned at 1.8.8. Its TaskGroup is experimental, and it has open interruption bugs after a handoff, so versions stay pinned and an upgrade must pass every lane's tests first.
