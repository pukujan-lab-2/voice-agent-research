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

## Fit for business bots

*Unverified rule of thumb, no source:* a 2B model is often said to be good for conversation and simple commands but weaker at reasoning and **tool calling**. Nothing here measured that, and no model card or benchmark is cited for it (corrected 2026-11-01, #55); treat it as a question to check, not a finding. The copilot runs a speech-to-text → LLM → text-to-speech cascade today, and LFM3-Audio is a planned swappable voice stack ([decision 0012](decisions/0012-swappable-voice-stacks.md)); see also [04](04-bot-factory-architecture.md), [08](08-speech-model-licenses.md).

## Links

- https://huggingface.co/LiquidAI/LFM3-Omni-2B
- https://docs.liquid.ai/lfm/models/lfm3-omni-2b
- https://docs.liquid.ai/lfm/models/omni-models
- https://huggingface.co/blog/LiquidAI/lfm3
- https://huggingface.co/LiquidAI/LFM3-Omni-2B-GGUF
- Voice demo: https://playground.liquid.ai/talk
