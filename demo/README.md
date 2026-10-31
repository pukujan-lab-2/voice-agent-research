# Copilot concept demo video

Before/after video: five fictional people use five fictional websites, first alone, then with a voice copilot.

- `script.py`: the scenes and dialogue. Voices come from ElevenLabs (cached in `build/tts/`). Builds `build/timeline.json` and `build/audio.wav`.
- `site/index.html`: five mini sites and the copilot UI. It plays the timeline.
- `record.mjs`: plays the page in headless Chromium, captures timestamped frames and encodes `out/copilot-demo.mp4`.
- `clips/gen.sh`: old Grok Imagine generator (Grok billing ended). Current clips come from Google Flow via the flow-video skill.
- `SKILL.md`: the procedure, rules and gotchas for changing and re-recording this demo.

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python soundfile imageio-ffmpeg numpy
npm i
npm run build    # voices + timeline (needs the ElevenLabs key in ~/Documents/projects/.env)
npm run record   # out/copilot-demo.mp4
```

This is a scripted concept demo, not a live prototype. The “without” timings are sped up and illustrative.
