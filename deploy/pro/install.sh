#!/usr/bin/env bash
# One-time setup on the MacBook Pro (deploy/README.md): installs the three launchd jobs from this folder's templates.
#   com.pukujan.copilot-speech         speech/server.py on 127.0.0.1:8799, all five stacks, swapped per call (decision 0014)
#   com.pukujan.copilot-speech-tunnel  reverse SSH tunnel: the VPS's 127.0.0.1:18799 (speech) and :18798 (LFM3-Audio)
#   com.pukujan.copilot-update         update.sh every 5 minutes
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$HERE/../.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
mkdir -p "$AGENTS" "$HOME/Library/Logs/copilot"
for job in copilot-speech copilot-speech-tunnel copilot-update; do
  sed -e "s#__HOME__#$HOME#g" -e "s#__REPO__#$REPO_DIR#g" "$HERE/com.pukujan.$job.plist" > "$AGENTS/com.pukujan.$job.plist"
  launchctl bootout "gui/$(id -u)/com.pukujan.$job" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$AGENTS/com.pukujan.$job.plist"
done
