# 0014. Voice models are swapped: only the stack in use is resident

**Status:** Accepted · **Date:** 2026-11-01 · **Refines:** [0012](0012-swappable-voice-stacks.md), [0013](0013-lfm3-audio-stack.md)

## Decision

The speech server keeps only the models of the stack in use in memory. When a call picks a different stack, the models that stack does not use are unloaded and its own are loaded. Models two stacks share stay. This covers Parakeet, Pocket TTS, Whisper, Kokoro, and the llama.cpp server that holds LFM3-Audio.

The owner's words (2026-11-01, relayed to #71): "i hope we dont run them all at once pls use them with swap set them up with swap". The details below are mine, and the owner can change them:

- **The call asks first.** The agent calls the speech server's `POST /load?stack=` before it greets, for every stack, so the swap happens before the greeting and never in the middle of it.
- **The default stack is loaded at start** (`english-fast`, or `--stack` / `SPEECH_PRELOAD`; `none` loads nothing), so a first call on it is fast.
- **A swap waits for requests still running on the old models.** A reply being spoken is finished first.
- **Nothing unloads when a call ends.** The models stay until a different stack is picked.
- **Unloading gives the memory back.** The llama.cpp process is ended; the Python models are dropped and collected, the pages handed back to macOS, and Whisper's model and its cached GPU buffers are cleared.

## Why

The Mac has 8 GB and was already swapping before any LFM3-Audio call (#71): during the call test, swap use reached 7.2 of 8.2 GB. A swap test on this Mac (2026-11-01, `POST /load` through english-fast, lfm3-audio, english-fast, multilingual, lfm3-audio, then english-fast, one pass) read the speech server's memory footprint after each step:

| Resident stack | Speech server | llama.cpp server |
|---|---|---|
| `english-fast` (Parakeet, Pocket TTS) | 1.78 GB | none |
| `lfm3-audio` | 0.31 GB | 0.60 GB |
| `multilingual` (Whisper, Kokoro) | 3.20 GB | none |
| `lfm3-audio`, after the multilingual one | 1.11 GB | 0.60 GB |

The graphics memory MLX held for Whisper dropped from 1,546 MB to 3 MB once Whisper was unloaded through its module (a first attempt looked it up on the wrong object and freed nothing). About 0.8 GB of ordinary memory stayed with the process after the multilingual stack was swapped out; after the next swap-in the process was within 0.1 GB of where it started (1.85 GB against 1.78 GB). The llama.cpp server's footprint (0.60 GB) is lower than the 1.49 GB resident size seen earlier, probably because its weights are file-backed pages the footprint does not count.

Swap-in took 3.2 to 3.8 s for `lfm3-audio` (files cached; 11 s from cold disk), 6.8 s for `english-fast` and 4.7 s for `multilingual`. A swap requested while an 18 s reply was streaming waited for the reply to end (9.5 s), then took 7.7 s; the reply arrived complete. A real LiveKit call that started with `english-fast` resident swapped to `lfm3-audio` in 3.3 s before its greeting, then heard both lines and replied.

## Consequences

- The first call on a different stack waits 3 to 7 s before the greeting. That wait is in the agent's `load_stack`, with a 300 s limit.
- One caller at a time is assumed, as before. Two calls on different stacks at once would queue, the second behind the first.
- Only the speech server's models swap. The LFM3 text model that `english-fast` uses is on another machine, and the page's engine is not a model.
- The unloaded `english-fast` models are reloaded from disk each time, so alternating stacks call by call costs a swap each time.
- `docs/decisions/0012` said the multilingual models load on the first call and stay; that now ends at the next swap.
