# 03 · LFM3-Omni-2B for hands-free voice

**LFM3-Omni-2B** (Liquid AI, released around 2026-10-27) is one ~2.2B-parameter model that takes text, image, video and **audio in**, and gives **text, speech, or interleaved text + speech out** (24 kHz). It replaces a separate speech-to-text, LLM and text-to-speech chain.

- Liquid reports a first token as early as ~50 ms after speech ends. That's a company best case, not independently verified.
- Context: 32K tokens. Input audio is resampled to 16 kHz mono.
- Earlier models: LFM2-Audio-1.5B, LFM2.5-Audio-1.5B.

## Running it

```bash
pip install "transformers>=5.20.2" accelerate torch torchvision torchcodec pillow soundfile librosa
```

- Classes: `AutoModelForMultimodalLM`, `AutoProcessor`, and `processor.audio_tokenizer` (the codec).
- `generation_mode`: `"text"`, `"audio"` or `"interleaved"`. If omitted, the system prompt decides ("Respond with interleaved text and audio.").
- Audio sampling: `audio_temperature=0.4`, `audio_repetition_penalty=1.2`, `audio_repetition_window=64`.
- The Transformers example is **not streaming**: it generates everything, then decodes audio.
- Checkpoints: BF16 (GPU, Transformers or SGLang, where SGLang is text output only) and **GGUF for llama.cpp** (CPU/GPU, docs mention a "realtime speech server").
- On a Mac without CUDA the Transformers path falls back to CPU float32, which is slow. Try llama.cpp/GGUF first.
- Not a reasoning model (`enable_thinking` unsupported).

## What it does *not* include

No VAD, endpointing, turn-taking or barge-in. You build that loop:

```
Mic (always on, 16 kHz)
  → Wake word (openWakeWord)
  → VAD: record until ~500–800 ms of silence (Silero VAD)
  → LFM3-Omni-2B (interleaved output)
  → Speaker playback
  └─ VAD keeps listening during playback → stop playback if user talks (barge-in)
```

**Echo is the hard part of barge-in:** use headphones, a speakerphone with built-in echo cancellation, or software AEC (macOS voice processing I/O, speexdsp, WebRTC AEC).

Suggested build order: file in → speech out, then live mic + VAD, then wake word, then barge-in.

## License

LFM Open License v1.0 (Apache-2.0 based): free if annual revenue is **under $10M USD**, otherwise a commercial license is needed (sales@liquid.ai). Research and evaluation are always allowed.

## LFM3-Audio-2B, the `lfm3-audio` voice stack

The copilot's `lfm3-audio` stack ([decision 0012](decisions/0012-swappable-voice-stacks.md), [0013](decisions/0013-lfm3-audio-stack.md), [#71](https://github.com/Pukujan-lab/voice-agent-research/issues/71)) runs **LFM3-Audio-2B**, the audio-only sibling of Omni: text or audio in, text, speech or both out, no images or video. Sources: the [model card](https://huggingface.co/LiquidAI/LFM3-Audio-2B), the [GGUF card](https://huggingface.co/LiquidAI/LFM3-Audio-2B-GGUF) and Liquid's [audio capabilities](https://docs.liquid.ai/lfm/key-concepts/audio-capabilities) page, read 2026-11-01.

- **How it runs on the 8 GB M1.** llama.cpp v0.8.0 (build b11960) or newer, with the 4-bit GGUF (`LFM3-Audio-2B-Q4_K_M.gguf`, 1,099.6 MB) and its audio projector (`mmproj-LFM3-Audio-2B-Q8_0.gguf`, 303.8 MB). The server used 1.49 GB once loaded. The other routes do not fit or do not exist yet: the Transformers example loads 32-bit floats on a CPU (about 8 GB), the MLX build waits for MLX-VLM support, and the ONNX repo is 19.7 GB across its variants.
- **What it does.** Speech to text (`Perform ASR in <language>.`), text to speech (`Perform TTS in <language> using a <female|male> voice.`, 24 kHz, streamed), spoken or written chat, and tool calls from spoken requests. A language is a word in the system prompt, not a setting.
- **Limits.** Voice chat and live recognition (while the caller is still talking) are English only, on the card. Recognising a finished recording, text to speech and translation cover 18 languages. The copilot cuts a turn at the pause and recognises the recording, so it hears and speaks through the 18-language path. Measured 2026-11-01 (#71): each of English, Spanish, French, Italian, Portuguese and Chinese went through the model's voice and back through its recogniser at 0.94 to 1.00 similarity. A whole turn held only in English: in Spanish and French the model called `propose_value` with no arguments. Hindi is not among its languages.
- **Licence.** LFM Open License v1.0, free under $10M annual revenue, as for Omni ([08](08-speech-model-licenses.md)).

## Fit for business bots

Tool calling was an open question here; it has a first measurement now (2026-11-01, [#71](https://github.com/Pukujan-lab/voice-agent-research/issues/71)). Liquid scores LFM3-Audio-2B 58.5 on its own tool-calling evaluation (Gemma 4 E4B 72.4, Gemma 4 E2B 55.6, Qwen2.5-Omni 3B 44.3); that is a vendor figure on a test we cannot see. Ours is `demo/live-site/tests/voice-tools.ts`: three scripted spoken calls where the model has to fill a field, change an earlier answer, confirm, and never fill a field at risk 60 without a clear yes. One run each: on `lfm3-audio` the model made the right call on 6 of 8 turns and the form ended right on 10 of 10; on `english-fast` (LFM3-1.7B) it was 7 of 8 and 9 of 10. Both can do the job in English; the runs are too few to rank them, and `english-fast` varied between runs. The code lock ([decision 0011](decisions/0011-model-leads-risk-sets-confirmation.md)) held in both runs, and the engine's own rule for a clear yes is what filled the field on the two turns where `lfm3-audio` made no call. The copilot runs a speech-to-text, LLM, text-to-speech cascade by default; see also [04](04-bot-factory-architecture.md), [08](08-speech-model-licenses.md).

## Links

- https://huggingface.co/LiquidAI/LFM3-Omni-2B
- https://docs.liquid.ai/lfm/models/lfm3-omni-2b
- https://docs.liquid.ai/lfm/models/omni-models
- https://huggingface.co/blog/LiquidAI/lfm3
- https://huggingface.co/LiquidAI/LFM3-Omni-2B-GGUF
- Voice demo: https://playground.liquid.ai/talk
