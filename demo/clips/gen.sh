#!/usr/bin/env bash
# Generates one Grok Imagine clip: gen.sh <name> <prompt> [start-image]
# A start image (e.g. the last frame of the "before" clip) keeps the same person and room.
name=$1; prompt=$2; img=${3:+--image $3}
for attempt in 1 2; do
  grok-cli video --json --duration 6 --aspect-ratio 16:9 --resolution 720p --timeout 600 $img --prompt "$prompt" > "$name.json" 2> "$name.err"
  url=$(python3 -I -c 'import json,sys;print(json.load(open(sys.argv[1]))["data"]["video"])' "$name.json" 2>/dev/null) && curl -s -m 180 -o "$name.mp4" "$url" && [ -s "$name.mp4" ] && { echo "$name ok"; exit 0; }
done
echo "$name FAILED"
