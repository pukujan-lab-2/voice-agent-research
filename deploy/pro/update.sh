#!/usr/bin/env bash
# The MacBook Pro's half of the deploy: keeps its checkout on origin/production and restarts the speech server when
# production moves. launchd runs it every 5 minutes (com.pukujan.copilot-update). See deploy/README.md.
# The restart drops the speech-to-text and text-to-speech of a call that is using the server (#76), so while a call may be open
# the whole update waits for the next run, up to CALL_WAIT_S (default 600) from the first time it waited, and then goes on. A call
# may be open when the site's LiveKit lists a room with anyone in it (GET /api/voice/calls), when the speech server has a request
# in flight, or when it finished one less than SPEECH_IDLE_S ago (/health: inflight, idle_s). The decision goes to the log.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SPEECH="$REPO_DIR/demo/live-site/speech"
export PATH="/opt/homebrew/bin:$PATH"
SITE="${SITE_URL:-https://copilot.design-bakery.com}"
SPEECH_HEALTH="${SPEECH_HEALTH_URL:-http://127.0.0.1:8799/health}"
CALL_WAIT_S="${CALL_WAIT_S:-600}"
SPEECH_IDLE_S="${SPEECH_IDLE_S:-20}"
DEFERRED="${UPDATE_DEFERRED_FILE:-$HOME/Library/Logs/copilot/update-deferred}"   # when the update first waited for a call
log() { echo "$(date -u +%FT%TZ) $*"; }

# Prints why a call may be open ("2 call(s) open", "speech request in flight", ...) or nothing. A site or server that can't be
# asked says nothing: an unreachable site must not hold the Pro's update back for ever.
busy() {
  local py="$SPEECH/.venv/bin/python" calls health reason=""
  [ -x "$py" ] || py=python3
  calls="$(curl -fsS -m 5 "$SITE/api/voice/calls" 2>/dev/null | "$py" -c 'import json,sys; print(json.load(sys.stdin).get("calls") or 0)' 2>/dev/null || echo 0)"
  health="$(curl -fsS -m 3 "$SPEECH_HEALTH" 2>/dev/null | "$py" -c 'import json,sys; d=json.load(sys.stdin); print(d.get("inflight", 0), d.get("idle_s", 9999))' 2>/dev/null || echo "0 9999")"
  [ "${calls:-0}" -gt 0 ] 2>/dev/null && reason="$calls call(s) open on the site"
  [ "${health%% *}" -gt 0 ] 2>/dev/null && reason="${reason:+$reason, }${health%% *} speech request(s) in flight"
  if [ -z "$reason" ] && awk -v idle="${health##* }" -v min="$SPEECH_IDLE_S" 'BEGIN { exit !(idle < min) }'; then reason="a speech request finished ${health##* }s ago"; fi
  echo "$reason"
}

git -C "$REPO_DIR" fetch --quiet origin production
SHA="$(git -C "$REPO_DIR" rev-parse origin/production)"
[ "$(git -C "$REPO_DIR" rev-parse HEAD)" = "$SHA" ] && [ -x "$SPEECH/.venv/bin/python" ] && exit 0

WHY="$(busy)"
if [ -n "$WHY" ]; then
  NOW="$(date +%s)"
  [ -f "$DEFERRED" ] || { mkdir -p "$(dirname "$DEFERRED")"; echo "$NOW" > "$DEFERRED"; }
  WAITED=$((NOW - $(cat "$DEFERRED")))
  if [ "$WAITED" -lt "$CALL_WAIT_S" ]; then log "update to production ${SHA:0:12} deferred, waited ${WAITED}s of ${CALL_WAIT_S}s: $WHY"; exit 0; fi
  log "update to production ${SHA:0:12}: still busy after ${WAITED}s ($WHY); restarting the speech server anyway"
elif [ -f "$DEFERRED" ]; then
  log "update to production ${SHA:0:12}: calls ended after waiting $(($(date +%s) - $(cat "$DEFERRED")))s; restarting the speech server"
fi
rm -f "$DEFERRED"

OLD_REQS="$(git -C "$REPO_DIR" show HEAD:demo/live-site/speech/requirements.txt 2>/dev/null || true)"
git -C "$REPO_DIR" checkout --quiet --detach "$SHA"
if [ ! -x "$SPEECH/.venv/bin/python" ] || [ "$OLD_REQS" != "$(cat "$SPEECH/requirements.txt")" ]; then
  uv venv --quiet --allow-existing --python 3.12 "$SPEECH/.venv"
  uv pip install --quiet --python "$SPEECH/.venv/bin/python" -r "$SPEECH/requirements.txt"
fi
launchctl kickstart -k "gui/$(id -u)/com.pukujan.copilot-speech"
log "speech server on production ${SHA:0:12}"
# Opt-in: place a real test call against the public site once the VPS has deployed, and record it in Phoenix.
if [ -f "$REPO_DIR/deploy/.voice-check" ]; then
  nohup "$REPO_DIR/deploy/pro/voice-check.sh" "$SHA" >> "$HOME/Library/Logs/copilot/voice-check.log" 2>&1 &
fi
