# 07 · Dictation apps (Wispr Flow and alternatives)

## Wispr Flow

Commercial AI dictation for Mac, Windows, iOS and Android. Hold a hotkey, speak, and clean text is typed into any app.

- AI cleanup (fillers, self-corrections, punctuation), Command Mode for voice editing
- 100+ languages including mixed (e.g. Hinglish), custom vocabulary and snippets
- Processing happens in the **cloud**, and reviewers raise privacy concerns
- Speed and accuracy claims come from the vendor or affiliate reviews
- Same pipeline as a voice bot minus the reply step: speech-to-text → LLM cleanup

## Repos named "WhisperFlow"

All small personal clones (under 80 stars). Fine for reading, not for building on.

| Repo | Stars | License | Notes |
|---|---|---|---|
| kshicdi/whisperflow | 35 | custom | macOS "JARVIS" assistant |
| cth9191/whisperflow-local | 13 | MIT | Windows, faster-whisper + CUDA |
| harshvsri/hyprflow | 29 | none | Linux, inactive since 2025-12 |

## Mature open-source alternatives (checked 2026-10-29)

| Project | Stars | Last commit | License | Notes |
|---|---|---|---|---|
| [Handy](https://github.com/cjpais/Handy) | 35k | 2026-10-27 | MIT | Fully offline, extensible |
| [OpenWhispr](https://github.com/OpenWhispr/openwhispr) | 10.3k | 2026-10-28 | MIT | Local (Parakeet/Whisper) or cloud using your own API key |
| [VoiceInk](https://github.com/Beingpax/VoiceInk) | 7k | 2026-10-29 | **GPL-3** | macOS only. Derived code you distribute must be GPL. |

Engines underneath: [whisper.cpp](https://github.com/ggml-org/whisper.cpp) (54.7k, MIT) and [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (26k, MIT).

## Sources

- https://wisprflow.ai/post/revolutionizing-accessibility-tools
- https://www.producthunt.com/products/wisprflow/launches
- https://www.wrdw.com/2026/09/21/what-tech-app-day-wispr-flow/
- https://www.businesswire.com/news/home/20240930079034/en
- https://use-apify.com/blog/wispr-flow-review
