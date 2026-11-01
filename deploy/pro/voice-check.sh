#!/usr/bin/env bash
# The voice test against the public site, with its result recorded in Phoenix on the deploy. It needs this Mac (macOS
# `say` and Chrome for Testing), so it can't run in GitHub Actions. Run it by hand after a deploy, or let update.sh start
# it when the file deploy/.voice-check exists (an opt-in: it places a real call and wakes the speech models).
# Usage: deploy/pro/voice-check.sh [commit]   (default: this checkout's commit)
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export PATH="/opt/homebrew/bin:$PATH"
SITE="${SITE_URL:-https://copilot.design-bakery.com}"
SHA="${1:-$(git -C "$REPO_DIR" rev-parse HEAD)}"
# The VPS deploys within about 5 minutes of the Pro's update; wait until the site answers.
for _ in $(seq 1 60); do curl -fsS "$SITE/api/health" >/dev/null && break; sleep 10; done
cd "$REPO_DIR/demo/live-site"
SITE_URL="$SITE" DEPLOY_SHA="$SHA" node --no-warnings tests/voice-call.ts
