# The parts of deploy/vps/autodeploy.sh that keep a deploy from cutting a call (#67, #76). Sourced by autodeploy.sh and by the
# tests (demo/live-site/tests/deploy-*.test.ts), which point the settings below at a scratch compose project.
#
#   wait_for_calls    before anything that drops a call's connection (the site's signalling, LiveKit, the speech bridges):
#                     wait up to CALL_WAIT_S for the open calls to end, then go on, and remember what happened for the record
#   start_agent       the new voice agent starts beside the old one and must register with LiveKit before the old one is told to stop
#   drain_old_agents  SIGTERM to every other agent: LiveKit Agents takes no new calls and exits when its calls end. An old agent
#                     that is asleep (Sablier stopped it, #117) holds no call and is removed at once
#   record_deploy     one line in the deploy log, and a `deploy` span in Phoenix, saying whether it waited, how long and for how many calls
# Calls are counted from LiveKit's room list with the server's own key (copilot.env), through open-calls.py run in a short-lived
# container of the agent image on LiveKit's network.

LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$LIB_DIR/.." && pwd)}"
COPILOT_PREFIX="${COPILOT_PREFIX:-copilot}"   # container names are <prefix>-web, <prefix>-livekit, <prefix>-agent-<tag>; a test uses its own
COPILOT_PROJECT="${COPILOT_PROJECT:-copilot}"
COPILOT_NETWORK="${COPILOT_NETWORK:-${COPILOT_PROJECT}_default}"
LIVEKIT_HOST="${LIVEKIT_HOST:-${COPILOT_PREFIX}-livekit}"
COPILOT_ENV_FILE="${COPILOT_ENV_FILE:-$(cd "$DEPLOY_DIR/../.." && pwd)/copilot.env}"
AGENT_COMPOSE="${AGENT_COMPOSE:-$DEPLOY_DIR/docker-compose.agent.yml}"
CALL_WAIT_S="${CALL_WAIT_S:-600}"     # the most a deploy waits for open calls; after it the deploy goes on and says so
CALL_POLL_S="${CALL_POLL_S:-5}"
AGENT_READY_S="${AGENT_READY_S:-120}" # the most a new agent gets to register with LiveKit
DEPLOY_LOG="${DEPLOY_LOG:-$DEPLOY_DIR/deploy.log}"
CHECK_IMAGE="${CHECK_IMAGE:-}"        # an agent image: it holds the LiveKit client that open-calls.py and deploy-span.py need

# What wait_for_calls found, for record_deploy: none (no call), waited (calls ended in time), gave-up (calls outlasted CALL_WAIT_S), unknown (LiveKit could not be asked).
WAIT_RESULT=none WAITED_S=0 CALLS_START=0 CALLS_END=0 WAIT_FOR=""
DRAINED=0 AGENT_STATE=unchanged RESTARTED=""

log() { local line; line="$(date -u +%FT%TZ) $*"; echo "$line"; echo "$line" >> "$DEPLOY_LOG" 2>/dev/null || true; }
pause() { sleep "$CALL_POLL_S"; }

# Open calls: rooms that hold anyone but the agent. Prints a number, or "unknown" when LiveKit or the image can't answer.
calls_open() {
  local n
  n="$(docker run --rm -i --network "$COPILOT_NETWORK" --env-file "$COPILOT_ENV_FILE" -e "LIVEKIT_URL=ws://$LIVEKIT_HOST:7880" \
        "$CHECK_IMAGE" python - < "$LIB_DIR/open-calls.py" 2>/dev/null | tail -n 1 || true)"
  case "$n" in ''|*[!0-9]*) echo unknown ;; *) echo "$n" ;; esac
}

# wait_for_calls <what the wait protects>   Always returns 0: a stuck call must not hold a release back.
wait_for_calls() {
  local n m waited=0
  WAIT_FOR="$1"; WAIT_RESULT=none WAITED_S=0 CALLS_START=0 CALLS_END=0
  n="$(calls_open)"
  if [ "$n" = unknown ]; then WAIT_RESULT=unknown; log "could not count open calls; not waiting before $WAIT_FOR"; return 0; fi
  CALLS_START="$n" CALLS_END="$n"
  [ "$n" -gt 0 ] && log "$n call(s) open; waiting up to ${CALL_WAIT_S}s before $WAIT_FOR"
  while [ "$n" -gt 0 ]; do
    if [ "$waited" -ge "$CALL_WAIT_S" ]; then WAIT_RESULT=gave-up; log "$n call(s) still open after ${waited}s; going on with $WAIT_FOR"; break; fi
    pause; waited=$((waited + CALL_POLL_S))
    m="$(calls_open)"
    [ "$m" = unknown ] || n="$m"   # a count that fails mid-wait changes nothing: the last count stands
    CALLS_END="$n"
  done
  WAITED_S="$waited"
  if [ "$WAIT_RESULT" = none ] && [ "$waited" -gt 0 ]; then WAIT_RESULT=waited; log "calls ended after ${waited}s; going on with $WAIT_FOR"; fi
  return 0
}

# --- the voice agent: one container per release, the old ones drain -----------------------------------------------------------
agent_compose() {
  local tag="$1"; shift
  AGENT_TAG="$tag" COPILOT_PREFIX="$COPILOT_PREFIX" COPILOT_AGENT_IMAGE="copilot-agent:$tag" COPILOT_ENV_FILE="$COPILOT_ENV_FILE" COPILOT_NETWORK="$COPILOT_NETWORK" LIVEKIT_HOST="$LIVEKIT_HOST" \
    docker compose -p "$COPILOT_PREFIX-agent-$tag" -f "$AGENT_COMPOSE" "$@"
}
# Agent containers in the given state ("running" or "all"): one per release, plus the single copilot-agent that docker-compose.vps.yml used to run.
agent_containers() {
  local a=""; [ "${1:-running}" = all ] && a=-a
  { docker ps $a --filter label=copilot.role=agent --filter "label=copilot.prefix=$COPILOT_PREFIX" --format '{{.Names}}'
    docker ps $a --filter "name=^$COPILOT_PREFIX-agent\$" --format '{{.Names}}'; } | sort -u
}
agent_tag_of() { docker inspect "$1" --format '{{index .Config.Labels "copilot.tag"}}' 2>/dev/null || true; }
state_of() { docker inspect "$1" --format '{{.State.Status}}' 2>/dev/null || true; }
restart_of() { docker inspect "$1" --format '{{.HostConfig.RestartPolicy.Name}}' 2>/dev/null || true; }
# The agent of release <tag> is running or asleep. Sablier stops an idle agent with a plain `docker stop`, which leaves its restart
# policy on, so the site can wake it; an agent that drain_old_agents told to stop has its restart off and is on its way out.
agent_present_for() {
  local c
  for c in $(agent_containers all); do
    [ "$(agent_tag_of "$c")" = "$1" ] && [ "$(restart_of "$c")" != no ] && return 0
  done
  return 1
}

# remove_agent <container> <what it was>   The end of its log is saved first, in deploy/agent-logs, because a removed container
# takes its log with it and a call that went wrong (#93) needs the agent's side of the story.
remove_agent() {
  local keep="${AGENT_LOG_DIR:-$DEPLOY_DIR/agent-logs}"
  mkdir -p "$keep" && docker logs --tail 3000 "$1" > "$keep/$1.log" 2>&1 || true
  docker rm "$1" >/dev/null 2>&1 && log "removed $2 agent $1 (log kept in agent-logs/$1.log)"
}

# Remove agents that have finished draining (they stay stopped: drain_old_agents turned their restart off), and keep the last
# AGENT_LOGS_KEPT saved logs. An agent that is only asleep is kept: it is the release's agent, or the one a failed deploy goes back to.
reap_agents() {
  local c keep="${AGENT_LOG_DIR:-$DEPLOY_DIR/agent-logs}" f
  for c in $(agent_containers all); do
    [ "$(state_of "$c")" = running ] && continue
    [ "$(restart_of "$c")" = no ] || continue
    remove_agent "$c" finished
  done
  # shellcheck disable=SC2012  # file names here are container names
  ls -t "$keep"/*.log 2>/dev/null | tail -n +"$((${AGENT_LOGS_KEPT:-20} + 1))" | while read -r f; do rm -f "$f"; done
  return 0
}

# start_agent <tag>   The agent of release <tag> beside whatever agents run. 0 when it registered with LiveKit.
start_agent() {
  local tag="$1" name="$COPILOT_PREFIX-agent-$1" waited=0
  if agent_present_for "$tag"; then AGENT_STATE=current; return 0; fi   # running, or asleep until the site wakes it
  docker rm -f "$name" >/dev/null 2>&1 || true   # a failed earlier try
  agent_compose "$tag" up -d --no-build agent >/dev/null
  while [ "$waited" -lt "$AGENT_READY_S" ]; do
    if docker logs "$name" 2>&1 | grep -q 'registered worker'; then AGENT_STATE=started; log "agent $name registered with LiveKit after ${waited}s"; return 0; fi
    [ "$(state_of "$name")" = running ] || break
    sleep 2; waited=$((waited + 2))
  done
  AGENT_STATE=failed; log "agent $name did not register within ${AGENT_READY_S}s; removing it and keeping the old agent"
  docker logs --tail 20 "$name" 2>&1 | sed 's/^/    /' || true
  docker rm -f "$name" >/dev/null 2>&1 || true
  return 1
}

# drain_old_agents <tag>   Every running agent that is not release <tag> and not already draining stops taking calls and exits when its calls end.
# Not waited for: the script goes on, and reap_agents removes the container on a later deploy. An old agent that is asleep holds
# no call; it is removed now, so the site can never wake it again.
drain_old_agents() {
  local tag="$1" c
  DRAINED=0
  for c in $(agent_containers all); do
    [ "$(agent_tag_of "$c")" = "$tag" ] && continue
    # Already told to stop (its restart policy is off): a second SIGTERM makes LiveKit Agents exit at once, with its calls (cli.py `_force_exit`).
    [ "$(restart_of "$c")" = no ] && continue
    if [ "$(state_of "$c")" != running ]; then remove_agent "$c" sleeping; continue; fi
    docker update --restart=no "$c" >/dev/null && docker kill --signal=SIGTERM "$c" >/dev/null
    DRAINED=$((DRAINED + 1)); log "draining agent $c (it keeps its calls, up to the agent's AGENT_DRAIN_S)"
  done
}

# --- the record ---------------------------------------------------------------------------------------------------------------
# record_deploy <sha> <started epoch>   Never fails the deploy.
record_deploy() {
  local sha="$1" started="$2" took attrs
  took=$(( $(date +%s) - started ))
  log "deploy $sha: wait=$WAIT_RESULT waited=${WAITED_S}s calls_at_start=$CALLS_START calls_at_end=$CALLS_END for='${WAIT_FOR:-nothing}' agent=$AGENT_STATE drained=$DRAINED restarted='${RESTARTED# }' took=${took}s"
  [ -n "$CHECK_IMAGE" ] || return 0
  attrs="$(printf '{"deploy.sha":"%s","deploy.wait_result":"%s","deploy.waited_s":%s,"deploy.calls_at_start":%s,"deploy.calls_at_end":%s,"deploy.wait_for":"%s","deploy.agent":"%s","deploy.agents_drained":%s,"deploy.restarted":"%s","deploy.took_s":%s}' \
    "$sha" "$WAIT_RESULT" "$WAITED_S" "$CALLS_START" "$CALLS_END" "${WAIT_FOR:-nothing}" "$AGENT_STATE" "$DRAINED" "${RESTARTED# }" "$took")"
  docker run --rm -i --env-file "$COPILOT_ENV_FILE" -e "DEPLOY_ATTRS=$attrs" -e "DEPLOY_STARTED=$started" "$CHECK_IMAGE" python - < "$LIB_DIR/deploy-span.py" 2>&1 | sed 's/^/    phoenix: /' || true
  return 0
}
