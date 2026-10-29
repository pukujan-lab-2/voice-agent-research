---
name: copilot-demo-video
description: Build and re-record the "website voice copilot" before/after concept demo (five personas, ElevenLabs voices, AI people clips, music bed) as a 16:9, phone-in-video, or vertical 9:16 Shorts video with Playwright. Use when asked to change the demo script, personas or layout, regenerate its people clips, or produce a new cut for desktop, mobile or Shorts.
---

# Copilot demo video

Folder: `chatbots/demo/` (repo `Pukujan/voice-agent-research`, public). Read `README.md` for the file
map. This file is the procedure and the lessons.

## The idea the video sells

A voice call to a copilot that lives **on one website** and walks you through it step by step:
asks, confirms, then acts, without you clicking anything. It is not a browser agent (roams the
web) and not a coding agent (for developers). Each site installs its own, scoped to that site's
actions, and it declines off-scope requests ("Can you order me lunch?" → "I can only help with IT
Desk things here").

## Pipeline

1. `script.py`: SCENES (narrator + persona lines + `act(...)` UI events) → ElevenLabs TTS (cached in
   `build/tts`) → `build/timeline.json` + `build/audio.wav`. Music bed (`build/music/bed.mp3`, made
   once with ElevenLabs `POST /v1/music`) is looped, ducked to 0.45 under speech, mixed at 0.16.
   Needs the ElevenLabs key in `~/Documents/projects/.env`; never print or commit it.
2. `site/index.html`: plays the timeline. Layout flag in the URL: none = 16:9 desktop, `?mobile` =
   phone frame inside 16:9 with side panels, `?vertical` = 720×1280 Shorts layout (HUD on top,
   phone in the middle, captions at the bottom).
3. `record.mjs [--vertical|--mobile]`: plays the page in headless Chromium, captures timestamped
   CDP screencast frames, encodes with ffmpeg → `out/copilot-demo[-vertical|-mobile].mp4`. Takes
   about as long as the video (~5.5 min). Make a 720p copy for phones (< 30 MB):
   `ffmpeg -i in.mp4 -vf scale=-2:1280 -crf 26 out-720p.mp4`.

```bash
.venv/bin/python script.py && node record.mjs --vertical
```

Setup: `uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python soundfile imageio-ffmpeg numpy pillow && npm i`.

## Script rules the user asked for

- **Step by step, never just auto-fill.** The copilot asks real questions ("What's your son's
  name?", "What's the problem?", "Mornings or afternoons?") and fills fields as answers arrive,
  then shows a confirm card before acting.
- **Hard identifiers get read back.** Marcus's serial `1334592CLSD3` is spelled back as
  `1334-592C-LSD3`; the chip first shows a deliberate mishear (`ISD3`), he corrects ("L as in
  Lima"), and it re-confirms.
- Each "after" scene shows the scope badge (`act("scope", ...)`).
- A compare scene shows browser agents vs coding agents vs a per-site copilot.
- Five people, five sites: Aisha (pediatrics booking), Marcus (warranty by serial number), Daniel
  (IT desk ticket), Sofia (Spanish, picks a plan by studio and budget), Harold (elderly, spells a
  name, payee code, print and email). See SCENES in `script.py` for the exact flows.

## People clips (the part that breaks)

Each persona has a "before" clip (struggling alone) and an "after" clip (relieved). The "after"
clip must start from the **last frame of the "before" clip** (`clips/<name>_last.jpg`), or the
person changes between the two. Files: `clips/<name>_before.mp4`, `clips/<name>_after.mp4`;
`script.py` converts them to `build/clips/*.webm`. Delete `build/clips/*_after.webm` after
replacing an after clip so it regenerates.

Generate with the **flow-video skill** (`~/Documents/projects/video-studio`, Google Flow / Veo on
the user's own Google AI plan, via the persistent Claude Chromium): use its `still-relief`
template with each `*_last.jpg` as `--image`. Earlier Grok clips ("billing_required") are no
longer available. Veo "after" clips are 8 s; scenes use 5 s.

Check every clip frame by frame before using it (the flow-video skill's QC step). Round 1 with a
loose prompt gave 1/5 clean clips: papers appearing and vanishing, hair changing, jump cuts,
laptop screens morphing. The strict template gave 4/4.

## Gotchas

- Page layout bugs show up in the recording only; check a mid-video frame of each mode.
- White text on the light purple copilot bubble in the side panel: `.mobile #log .msg.c{color:var(--ink)}`.
- Tooltip positions must be divided by the page scale `k`.
- `clips/*.mp4|jpg` and `out/` are git-ignored (large). A fresh clone has the code but not the
  clips: regenerate them, or copy `clips/` from the Mac that made them.
