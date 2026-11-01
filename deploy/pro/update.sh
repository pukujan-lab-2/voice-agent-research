#!/usr/bin/env bash
# The MacBook Pro's half of the deploy: keeps its checkout on origin/production and restarts the speech server when
# production moves. launchd runs it every 5 minutes (com.pukujan.copilot-update). See deploy/README.md.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SPEECH="$REPO_DIR/demo/live-site/speech"
export PATH="/opt/homebrew/bin:$PATH"

git -C "$REPO_DIR" fetch --quiet origin production
SHA="$(git -C "$REPO_DIR" rev-parse origin/production)"
[ "$(git -C "$REPO_DIR" rev-parse HEAD)" = "$SHA" ] && [ -x "$SPEECH/.venv/bin/python" ] && exit 0

OLD_REQS="$(git -C "$REPO_DIR" show HEAD:demo/live-site/speech/requirements.txt 2>/dev/null || true)"
git -C "$REPO_DIR" checkout --quiet --detach "$SHA"
if [ ! -x "$SPEECH/.venv/bin/python" ] || [ "$OLD_REQS" != "$(cat "$SPEECH/requirements.txt")" ]; then
  uv venv --quiet --allow-existing --python 3.12 "$SPEECH/.venv"
  uv pip install --quiet --python "$SPEECH/.venv/bin/python" -r "$SPEECH/requirements.txt"
fi
launchctl kickstart -k "gui/$(id -u)/com.pukujan.copilot-speech"
echo "$(date -u +%FT%TZ) speech server on production ${SHA:0:12}"
# Opt-in: place a real test call against the public site once the VPS has deployed, and record it in Phoenix.
if [ -f "$REPO_DIR/deploy/.voice-check" ]; then
  nohup "$REPO_DIR/deploy/pro/voice-check.sh" "$SHA" >> "$HOME/Library/Logs/copilot/voice-check.log" 2>&1 &
fi
