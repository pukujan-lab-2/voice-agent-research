# 0013. The lfm3-audio stack is one model, listed in English only

**Status:** Accepted · **Date:** 2026-11-01 · **Refines:** [0012](0012-swappable-voice-stacks.md) · **Refined by:** [0014](0014-voice-models-are-swapped.md)

## Decision

The `lfm3-audio` voice stack runs LFM3-Audio-2B as the listener, the voice and the model behind the desk's tool calls, on llama.cpp's server with the 4-bit `Q4_K_M` file. It starts on the first call that picks the stack and ends when a different stack is picked (decision 0014), so a day on another stack never holds it in the M1's 8 GB. Turns end on voice activity alone, because the model has no turn detector of its own.

Three things in it are mine, not the owner's, and the owner can reverse any of them:

- **Hearing is per turn, not live.** The call cuts a turn at the pause and recognises the recording (`Perform ASR in <language>.`). The model's live recogniser and its voice chat mode are English only on its card, and the copilot engine needs the words of a turn for its own checks (a clear yes, a value the caller said), so neither is used.
- **The desk's tool calls go to the same model** when the call's stack is `lfm3-audio` (`/api/desk` reads the stack the page sends), with the system prompt ending "List of tools:" as the card says. Decision 0011's code lock is unchanged and runs on its output.
- **The stack lists English only.** The hearing and the voice alone worked in English, Spanish, French, Italian, Portuguese and Chinese in a round trip, but a whole turn held only in English; in Spanish and French the model called `propose_value` with no arguments. `stacks.json` lists what a call test showed.

## Why

The owner chose LFM3-Audio end to end (2026-10-31 and 2026-11-01, #71), and then, with decision 0012, a set of stacks to swap and test. The first measurements on this Mac (#71):

- Tool calling in English: on a scripted spoken test the model made the right call on 6 of 8 turns and the form ended right on 10 of 10 (one run); `english-fast` made 7 of 8 and 9 of 10 (one run, and it varied between runs). The code lock held in both.
- A real LiveKit call completed on the stack: greeting, two heard lines, two replies. Recognition took about 1.0 s a turn and the voice's first audio came in 0.2 to 0.8 s.
- The model server uses 1.49 GB, and the Mac was already swapping before it started.

## Consequences

- Memory is tight: with the owner's demo running, the call test (the model server, a second LiveKit server and the agent) took the Mac's swap to 7.2 of 8.2 GB, and the agent logged its voice-activity check running slower than real time. Decision 0014 now unloads the other stacks' models when this one is picked.
- Non-speech audio that gets past the voice-activity check can come back as "Thank you." (seen twice on 2 s of noise), which the desk would take as a turn.
- On a turn where the model makes no call, its commentary can reach the reply ("Customer said …"), as it did once in the test. The desk's text rules did not catch it.
- The owner decides whether a stack with LFM3-Audio's hearing and voice and the LFM3 text model deciding should exist, so the six languages work. It is a different stack from "LFM3-Audio end to end", so it is not built.
- The files live outside git in `speech/models/lfm3-audio/` (`speech/requirements.txt` says where they come from). The licence is the LFM Open License v1.0, free under $10M annual revenue.
