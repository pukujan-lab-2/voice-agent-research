# 0012. Voice calls run on swappable voice stacks

**Status:** Accepted · **Date:** 2026-11-01

## Decision

A voice call runs on one of several **voice stacks**, and each stack can be swapped for any call. A stack is the set of models that listen, judge the end of a turn, and speak. They are listed in one file, `demo/live-site/speech/stacks.json`, which the server, the agent and the speech server all read:

| Stack | Listens | Ends turns | Writes replies | Speaks | Languages |
|---|---|---|---|---|---|
| `english-fast` (default) | Parakeet TDT 0.6B v2 | LiveKit English turn detector | LFM3 (decision 0009) | Pocket TTS | English |
| `parakeet-kokoro` | Parakeet TDT 0.6B v2 | LiveKit English turn detector | LFM3 | Kokoro-82M | English |
| `whisper-pocket` | Whisper large-v3-turbo | LiveKit multilingual turn detector | LFM3 | Pocket TTS | English |
| `multilingual` | Whisper large-v3-turbo on Apple's GPU (mlx-whisper) | LiveKit `MultilingualModel` | LFM3 | Kokoro-82M | English, Spanish, French, Italian, Portuguese, Hindi, Chinese |
| `lfm3-audio` (later, own step) | LFM3-Audio | voice activity only | LFM3-Audio | LFM3-Audio | per its model card |

**Who picks the stack.** The owner can force one stack for every call (`VOICE_STACK` on the server). Otherwise the visitor picks from the stacks the business allows. Otherwise the business default applies, and with none set, `english-fast`. Each business's copilot config holds `voice: { stacks, default }`.

The voice lab offers the two connected listeners and the two connected voices in four combinations. The two cross-pairs are English-only: Parakeet v2 and Pocket TTS each limit their respective pair to English. Other models remain listed as candidates until adapters and call tests exist.

**The caller's language.** The caller picks a language by the call button before the call. If they don't, the agent asks at the start and goes by what the recogniser hears. They can switch during the call, from the picker or by asking ("can we speak Spanish?"). The chosen language goes to speech to text, the turn detector (through the language the recogniser reports) and the voice. LFM3 is told to write in it. Lines that code writes, such as the greeting, read-backs and small talk, are translated by LFM3 before they are spoken. The reported language is the one the recogniser heard, not a fixed `'en'`.

Every stack's actions go through the same decision 0011 code lock: the stack only listens and speaks, and the copilot engine in the page still decides every reply.

## Why

The owner asked for several stacks to swap and test, not one fixed stack (2026-11-01, #55): "cant we do multiple versions ? and swap them as we like?" and "let people or business or me pick them as i like then we can test all as we like". The owner also asked for a language picker, because automatic language recognition can get it wrong.

The parts come from what the issue and earlier notes already name:

- Whisper large-v3-turbo covers about 99 languages, and `docs/08-speech-model-licenses.md` recommends it with Kokoro.
- Kokoro speaks the languages listed above through its espeak phonemes, with a voice made for each.
- LiveKit's multilingual turn detector covers 14 languages (its `languages.json`), and every stack language above is one of them.

Japanese is left out: Kokoro's espeak phonemes for it came out about 9 s long for a one-second greeting, which means the phonemes are wrong. It needs the misaki phonemizer first.

## Consequences

- The multilingual models load on the first call that uses them, so an English-only day doesn't hold them in the M1's 8 GB. Whisper takes about 30 s to load. A turn then takes about 3 s to transcribe with the language given, and about 5 s when Whisper has to detect it (one Spanish sentence, measured once while building, not a benchmark). `english-fast` stays the default for that reason.
- A non-English call costs one extra LFM3 call per spoken turn, to translate the lines code writes. Text on screen stays as the engine wrote it, so code-written lines show in English.
- The business's allowed stacks come from the page's config today, because every demo site's config lives in the page. When businesses are stored server-side (Octo, decision 0004), the server reads them from there instead.
- `lfm3-audio` needs a LiveKit adapter. It plugs in at `voice_parts()` in `speech/agent.py` and lands as its own step.
