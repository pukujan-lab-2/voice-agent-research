#!/usr/bin/env bash
# Deploy origin/production to the VPS. Komodo's copilot stack runs this as its pre-deploy
# (Pukujan-lab/server-management komodo/resources/stacks-vps.toml), and the copilot-deploy-on-push action
# triggers that stack when production moves. Copied from nyc-map-agent's deploy/vps/autodeploy.sh.
#
# Builds production as copilot-web:<12-char sha> and copilot-agent:<sha>, swaps the web container, waits for its health
# check and puts the previous images back if that fails. The agent is swapped last, once no call is open (open-calls.py):
# a new agent never joins a room that already exists, so replacing it mid-call leaves the caller talking to nobody (#67).
# A call that outlasts CALL_WAIT_S (default 600) is cut off rather than holding a release back. Exits early when the running image is already
# production. Either way it writes deploy/.env, which compose reads by itself, so Komodo's `compose up` afterwards
# resolves the same images and changes nothing.
# A commit that failed is remembered in .deploy-failed and not retried every 5 minutes; delete that file to retry it.
set -euo pipefail

BRANCH=production
CALL_WAIT_S="${CALL_WAIT_S:-600}"
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
OWNER="$(stat -c %U "$REPO_DIR")"
COMPOSE=(docker compose -f "$DEPLOY_DIR/docker-compose.vps.yml")

# Komodo's agent runs as root; the checkout belongs to its owner, so git runs as them.
git_() {
  if [ "$(id -un)" = "$OWNER" ]; then git -C "$REPO_DIR" "$@"
  else sudo -u "$OWNER" git -C "$REPO_DIR" "$@"; fi
}

write_images() { printf 'COPILOT_WEB_IMAGE=copilot-web:%s\nCOPILOT_AGENT_IMAGE=copilot-agent:%s\n' "$1" "$1" > "$DEPLOY_DIR/.env"; }
agent_tag() { local t; t="$(docker inspect copilot-agent --format '{{.Config.Image}}' 2>/dev/null || true)"; echo "${t#copilot-agent:}"; }
calls_open() { local n; n="$(docker exec -i copilot-agent python - < "$DEPLOY_DIR/vps/open-calls.py" 2>/dev/null || true)"; case "$n" in ''|*[!0-9]*) echo 0 ;; *) echo "$n" ;; esac; }
wait_for_calls() {
  local waited=0 n
  while n="$(calls_open)"; [ "$n" -gt 0 ]; do
    if [ "$waited" -ge "$CALL_WAIT_S" ]; then echo "$n call(s) still open after ${CALL_WAIT_S}s; replacing the agent anyway" >&2; return 0; fi
    [ "$waited" -eq 0 ] && echo "$n call(s) open; waiting up to ${CALL_WAIT_S}s before replacing the agent"
    sleep 5; waited=$((waited + 5))
  done
}
tag_of() { local t; t="$(docker inspect copilot-web --format '{{.Config.Image}}' 2>/dev/null || true)"; echo "${t#copilot-web:}"; }

git_ fetch --quiet origin "$BRANCH"
SHA="$(git_ rev-parse "origin/$BRANCH")"
TAG="${SHA:0:12}"
RUNNING="$(tag_of)"

if [ "$RUNNING" = "$TAG" ]; then
  echo "copilot-web already runs $BRANCH ($TAG)"
  write_images "$TAG"
  [ "$(agent_tag)" = "$TAG" ] || wait_for_calls
  "${COMPOSE[@]}" up -d --no-build
  exit 0
fi

if [ "$(cat "$DEPLOY_DIR/.deploy-failed" 2>/dev/null)" = "$SHA" ]; then
  echo "$BRANCH $TAG failed to deploy before; keeping ${RUNNING:-nothing} (delete deploy/.deploy-failed to retry)"
  [ -n "$RUNNING" ] && write_images "$RUNNING"
  exit 0
fi

echo "$BRANCH is $TAG, running ${RUNNING:-nothing}: deploying"
git_ checkout --quiet --detach "$SHA"
COPILOT_WEB_IMAGE="copilot-web:$TAG" COPILOT_AGENT_IMAGE="copilot-agent:$TAG" "${COMPOSE[@]}" build web agent
COPILOT_WEB_IMAGE="copilot-web:$TAG" COPILOT_AGENT_IMAGE="copilot-agent:$TAG" "${COMPOSE[@]}" up -d --no-deps web

for _ in $(seq 1 30); do
  STATUS="$(docker inspect copilot-web --format '{{.State.Health.Status}}' 2>/dev/null || true)"
  if [ "$STATUS" = "healthy" ]; then
    wait_for_calls
    COPILOT_WEB_IMAGE="copilot-web:$TAG" COPILOT_AGENT_IMAGE="copilot-agent:$TAG" "${COMPOSE[@]}" up -d --no-deps agent
    write_images "$TAG"
    rm -f "$DEPLOY_DIR/.deploy-failed"
    echo "deployed $TAG"
    exit 0
  fi
  sleep 5
done

echo "$SHA" > "$DEPLOY_DIR/.deploy-failed"
echo "copilot-web did not become healthy on $TAG (last status: ${STATUS:-none})" >&2
if [ -n "$RUNNING" ]; then
  echo "rolling back to $RUNNING" >&2
  COPILOT_WEB_IMAGE="copilot-web:$RUNNING" COPILOT_AGENT_IMAGE="copilot-agent:$RUNNING" "${COMPOSE[@]}" up -d
  write_images "$RUNNING"
fi
exit 1
