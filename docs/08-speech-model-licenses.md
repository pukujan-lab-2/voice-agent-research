# 08 · Speech model licenses (commercial use)

Declared licenses checked via the Hugging Face API on 2026-10-29 (`scripts/check_licenses.sh`). ✅ = declared license allows commercial use. ❌ = non-commercial. ⚠️ = custom terms, read them.

> Declared license ≠ guaranteed clean. Training data can impose limits (OmniVoice is the example). Not legal advice.

## The "Max pack" that prompted this

A local model pack (Windows + CUDA) bundled these five:

| Model | Role | License |
|---|---|---|
| k2-fsa/OmniVoice | TTS, 600+ languages, voice cloning | ❌ code Apache-2.0, but **weights CC-BY-NC** ("due to constraints from its training data (e.g., Emilia)") |
| Whisper large-v3 (faster-whisper) | Speech-to-text | ✅ Apache-2.0 / MIT |
| Whisper Tiny (sherpa-onnx) | Dictation | ✅ MIT |
| Parakeet TDT v3 (sherpa-onnx) | Dictation | ✅ CC-BY-4.0 |
| NLLB-200 distilled 600M | Translation | ❌ CC-BY-NC-4.0 |

Runtimes: sherpa-onnx (k2-fsa, Apache-2.0), faster-whisper (MIT).

## Speech-to-text

| Model | License | Notes |
|---|---|---|
| nvidia/parakeet-tdt-0.6b-v3 | ✅ CC-BY-4.0 | Fast, accurate, European languages. Credit NVIDIA. |
| openai/whisper-large-v3-turbo | ✅ MIT | Near large-v3 accuracy, much faster, 99 languages |
| openai/whisper-large-v3 | ✅ Apache-2.0 | Most accurate, slowest |
| Systran/faster-whisper-large-v3 | ✅ MIT | CTranslate2 build |
| distil-whisper/distil-large-v3.5 | ✅ MIT | English-focused |
| nvidia/canary-1b-v2 | ✅ CC-BY-4.0 | Speech-to-text + translation |
| mistralai/Voxtral-Mini-3B-2507 | ✅ Apache-2.0 | Speech understanding |
| kyutai/stt-2.6b-en | ✅ CC-BY-4.0 | Streaming English |
| ibm-granite/granite-speech-3.3-8b | ✅ Apache-2.0 | Large |

## Text-to-speech

| Model | License | Notes |
|---|---|---|
| hexgrad/Kokoro-82M | ✅ Apache-2.0 | Tiny, fast, trained on permissive data. Fixed voices. **Default for bots.** |
| ResembleAI/chatterbox | ✅ MIT | Voice cloning, multilingual V3, adds a watermark |
| microsoft/VibeVoice-1.5B | ✅ MIT | Long-form, multi-speaker |
| kyutai/tts-1.6b-en_fr | ✅ CC-BY-4.0 | Streaming, English and French |
| nari-labs/Dia-1.6B | ✅ Apache-2.0 | Dialogue |
| sesame/csm-1b | ✅ Apache-2.0 | Gated (accept terms) |
| neuphonic/neutts-air | ✅ Apache-2.0 | Gated |
| myshell-ai/MeloTTS-English | ✅ MIT | Lightweight |
| canopylabs/orpheus-3b-0.1-ft | ⚠️ Apache-2.0 declared | Believed to be built on Llama 3.2, so the Llama license may also apply |
| IndexTeam/IndexTTS-2 | ⚠️ bilibili Model Use License | Separate license needed above 100M MAU or RMB 1B revenue. You must pass its terms on to anyone you distribute the model to. |
| k2-fsa/OmniVoice | ❌ CC-BY-NC (weights) | |
| SWivid/F5-TTS | ❌ CC-BY-NC-4.0 | |
| coqui/XTTS-v2 | ❌ Coqui Public Model License | |
| fishaudio/s1-mini, fish-speech-1.5 | ❌ CC-BY-NC-SA-4.0 | s2-pro/drama-3 are "other" |

## Translation

| Model | License | Notes |
|---|---|---|
| google/madlad400-3b-mt | ✅ Apache-2.0 | 400+ languages, closest NLLB replacement |
| facebook/m2m100_418M, m2m100_1.2B | ✅ MIT | 100 languages |
| Helsinki-NLP/opus-mt-* | ✅ Apache-2.0 (en-es checked; varies by pair) | Small, one model per pair |
| utter-project/EuroLLM-9B-Instruct | ✅ Apache-2.0 | Gated |
| facebook/nllb-200-distilled-600M | ❌ CC-BY-NC-4.0 | |
| facebook/seamless-m4t-v2-large | ❌ CC-BY-NC-4.0 | |

## Diarisation

| Model | License | Notes |
|---|---|---|
| pyannote/speaker-diarization-3.1 (+ segmentation-3.0) | ✅ MIT | Gated |
| pyannote/speaker-diarization-community-1 | ✅ CC-BY-4.0 | Gated |
| nvidia/diar_streaming_sortformer_4spk-v2 | ✅ CC-BY-4.0 | |
| nvidia/diar_sortformer_4spk-v1 | ❌ CC-BY-NC-4.0 | |

## Local LLM

| Model | License |
|---|---|
| Qwen/Qwen3-4B-Instruct-2507 | ✅ Apache-2.0 |
| openai/gpt-oss-20b | ✅ Apache-2.0 |
| mistralai/Mistral-Small-3.2-24B-Instruct-2506 | ✅ Apache-2.0 |
| LiquidAI/LFM3-Omni-2B | ⚠️ free under $10M annual revenue |

VAD: Silero VAD (MIT).

## Suggested commercial pack

Parakeet v3 (live) + Whisper large-v3-turbo (other languages/recordings) → Qwen3-4B / gpt-oss-20b or Claude → Kokoro (default) or Chatterbox (cloned voices) + MADLAD-400 + pyannote + Silero VAD.

## Remaining risks

- **espeak-ng** (phonemizer used by Kokoro and others) is GPL-3. Running it server-side is generally fine. Shipping it inside a client app brings GPL obligations.
- **CC-BY attribution** for Parakeet, Canary, Kyutai, pyannote community-1 and Sortformer v2.
- **Voice cloning:** get written consent and keep watermarks on.
- **Gated models:** read the terms before shipping.
