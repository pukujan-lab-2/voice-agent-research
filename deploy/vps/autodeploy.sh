#!/usr/bin/env bash
# Deploy origin/production to the VPS. Komodo's copilot stack runs this as its pre-deploy
# (pukujan-lab-2/server-management komodo/resources/stacks-vps.toml), and the copilot-deploy-on-push action
# triggers that stack when production moves. Copied from nyc-map-agent's deploy/vps/autodeploy.sh.
#
# A deploy must not cut a call that is open (#67, #76), and the functions that see to it are in lib.sh:
#   1. Build copilot-web:<12-char sha> and copilot-agent:<sha>. Nothing running is touched yet.
#   2. If a call is open, wait for it, up to CALL_WAIT_S (default 600), before anything that drops a call's connection: the site
#      (it carries LiveKit's signalling), LiveKit itself and the speech bridges when their configuration changed. Then go on.
#   3. Swap the web container, wait for its health check and put the previous image back if that fails.
#   4. Start the new voice agent beside the old one and wait until it has registered with LiveKit; new calls go to it. If it
#      does not register, remove it, put the web container back and keep the old agent.
#   5. Tell the old agent to stop (SIGTERM): LiveKit Agents takes no new calls and exits when its calls end. Not waited for.
#   6. Write the record: a line in deploy/deploy.log and a `deploy` span in Phoenix (whether it waited, how long, for how many calls).
# Exits early when the running web image is already production (the agent is still brought to production if it lags). Either way
# it writes deploy/.env, which compose reads by itself, so Komodo's `compose up` afterwards resolves the same image and changes
# nothing. The agent is not in Komodo's compose file (docker-compose.agent.yml), so Komodo never replaces it.
# A commit that failed is remembered in .deploy-failed and not retried every 5 minutes; delete that file to retry it.
set -euo pipefail

BRANCH=production
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
# shellcheck source=lib.sh
. "$DEPLOY_DIR/vps/lib.sh"
OWNER="$(stat -c %U "$REPO_DIR" 2>/dev/null || stat -f %Su "$REPO_DIR")"  # GNU stat on the VPS, BSD stat on a Mac
COMPOSE=(docker compose -f "$DEPLOY_DIR/docker-compose.vps.yml")
SERVICES_BEHIND_CALLS=(livekit speech-bridge audio-bridge)  # restarted only when their configuration changed

# Komodo's agent runs as root; the checkout belongs to its owner, so git runs as them.
git_() {
  if [ "$(id -un)" = "$OWNER" ]; then git -C "$REPO_DIR" "$@"
  else sudo -u "$OWNER" git -C "$REPO_DIR" "$@"; fi
}

write_images() { printf 'COPILOT_WEB_IMAGE=copilot-web:%s\n' "$1" > "$DEPLOY_DIR/.env"; }
tag_of() { local t; t="$(docker inspect "$COPILOT_PREFIX-web" --format '{{.Config.Image}}' 2>/dev/null || true)"; echo "${t#copilot-web:}"; }
# True when `compose up` would create or replace this service: no container, or its configuration changed.
needs_recreate() {
  local want have
  want="$(COPILOT_WEB_IMAGE="copilot-web:${TAG:-local}" "${COMPOSE[@]}" config --hash "$1" 2>/dev/null | awk '{print $2}' || true)"
  have="$(docker inspect "$COPILOT_PREFIX-$1" --format '{{index .Config.Labels "com.docker.compose.config-hash"}}' 2>/dev/null || true)"
  [ "$want" != "$have" ]
}
changed_services() { local s; for s in "${SERVICES_BEHIND_CALLS[@]}"; do needs_recreate "$s" && printf '%s ' "$s"; done; return 0; }

git_ fetch --quiet origin "$BRANCH"
SHA="$(git_ rev-parse "origin/$BRANCH")"
TAG="${SHA:0:12}"
RUNNING="$(tag_of)"
STARTED="$(date +%s)"
CHECK_IMAGE="copilot-agent:$TAG"

reap_agents

if [ "$RUNNING" = "$TAG" ]; then
  echo "copilot-web already runs $BRANCH ($TAG)"
  write_images "$TAG"
  # The agent may lag (an earlier deploy stopped after the web swap, or the agents used to live in this compose file).
  if ! agent_running_for "$TAG"; then
    docker image inspect "$CHECK_IMAGE" >/dev/null 2>&1 || agent_compose "$TAG" build agent
    start_agent "$TAG" && drain_old_agents "$TAG"
  fi
  CHANGED="$(changed_services)"
  [ -n "$CHANGED" ] && { wait_for_calls "restarting $CHANGED"; RESTARTED="$CHANGED"; }
  "${COMPOSE[@]}" up -d --no-build
  [ -n "$RESTARTED" ] || [ "$AGENT_STATE" != unchanged ] && record_deploy "$TAG" "$STARTED"
  exit 0
fi

if [ "$(cat "$DEPLOY_DIR/.deploy-failed" 2>/dev/null)" = "$SHA" ]; then
  echo "$BRANCH $TAG failed to deploy before; keeping ${RUNNING:-nothing} (delete deploy/.deploy-failed to retry)"
  [ -n "$RUNNING" ] && write_images "$RUNNING"
  exit 0
fi

echo "$BRANCH is $TAG, running ${RUNNING:-nothing}: deploying"
git_ checkout --quiet --detach "$SHA"
COPILOT_WEB_IMAGE="copilot-web:$TAG" "${COMPOSE[@]}" build web
agent_compose "$TAG" build agent

CHANGED="$(changed_services)"
wait_for_calls "swapping the site${CHANGED:+ and $CHANGED}"
RESTARTED="web ${CHANGED}"
# shellcheck disable=SC2086  # CHANGED is a list of service names
COPILOT_WEB_IMAGE="copilot-web:$TAG" "${COMPOSE[@]}" up -d --no-deps web $CHANGED

for _ in $(seq 1 30); do
  STATUS="$(docker inspect "$COPILOT_PREFIX-web" --format '{{.State.Health.Status}}' 2>/dev/null || true)"
  if [ "$STATUS" = "healthy" ]; then
    if start_agent "$TAG"; then
      drain_old_agents "$TAG"
      write_images "$TAG"
      rm -f "$DEPLOY_DIR/.deploy-failed"
      record_deploy "$TAG" "$STARTED"
      echo "deployed $TAG"
      exit 0
    fi
    STATUS="healthy, but the new agent did not register with LiveKit"
    break
  fi
  sleep 5
done

echo "$SHA" > "$DEPLOY_DIR/.deploy-failed"
echo "deploying $TAG failed (copilot-web: ${STATUS:-none})" >&2
if [ -n "$RUNNING" ]; then
  echo "rolling back the site to $RUNNING; the agents are left as they are" >&2
  COPILOT_WEB_IMAGE="copilot-web:$RUNNING" "${COMPOSE[@]}" up -d --no-deps web
  write_images "$RUNNING"
fi
AGENT_STATE="${AGENT_STATE/unchanged/failed}"
record_deploy "$TAG" "$STARTED"
exit 1
