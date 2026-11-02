# Deploying the copilot lab

A merge to `main` goes live by itself: when CI passes, `.github/workflows/promote.yml` moves `production` to that commit and the lab deploys ([decision 0016](../docs/decisions/0016-merges-go-live.md), which replaces 0015). You can still move `production` by hand with `git push origin main:production`, for example to roll back one commit. The site is https://copilot.design-bakery.com.

```mermaid
graph TD
  A[production moves on GitHub] --> B[Komodo action copilot-deploy-on-push]
  A --> P[Pro: update.sh every 5 min]
  B --> C[VPS: deploy/vps/autodeploy.sh]
  C --> W[wait for open calls, at most 10 min]
  W --> D[swap copilot-web, then start the new agent]
  D --> E[old agent drains and exits]
  P --> Q{call open?}
  Q -->|no| R[Pro: speech server restarted]
  Q -->|yes| S[wait for the next run]
```

1. Komodo's `copilot-deploy-on-push` action checks GitHub every 5 minutes. When `production` is ahead of the running `copilot-web` image, it deploys the `copilot` stack.
2. That stack's pre-deploy runs [`vps/autodeploy.sh`](vps/autodeploy.sh). It builds both images tagged with the commit, waits for open calls (below), swaps `copilot-web`, waits for `/api/health` (and puts the previous image back if that fails), then starts the new voice agent beside the old one.
3. On the MacBook Pro, [`pro/update.sh`](pro/update.sh) moves its checkout to `production` within 5 minutes and restarts the speech server, unless a call may be using it (below).

## A deploy does not cut a call

Every merge to `main` deploys (decision 0016), so a deploy while someone is on a call is the normal case (#67, #76). Three things keep it from hurting.

**The voice agent drains.** The agent is not in `docker-compose.vps.yml`: [`docker-compose.agent.yml`](docker-compose.agent.yml) runs one container per release (`copilot-agent-<12-char sha>`, its own compose project), so Komodo's `compose up` never replaces it. A new agent starts beside the old one and must log `registered worker` (LiveKit has accepted it) before the old one is told to stop. LiveKit sends each new call to a worker that has room, and a worker that is draining has none. The old agent gets SIGTERM; LiveKit Agents 1.8.8 (`cli/cli.py`, `worker.py`) then calls `drain()` in `start` mode: it reports itself full, keeps the jobs it holds, and exits when they end, or after `drain_timeout` (the agent sets `AGENT_DRAIN_S`, default 1200 s; the library's own default is 3600 s). `stop_grace_period` in the compose file (1230 s) is longer than that, so a plain `docker stop` also waits. `autodeploy.sh` turns the old container's restart policy off first (otherwise Docker would start it again when it exits) and does not wait for it; the next deploy removes the finished container. A call longer than 20 minutes after its agent was told to stop is cut when the drain times out.

**Anything that drops a call waits for it.** Before the site (it carries LiveKit's signalling at `/rtc`), LiveKit, or the speech bridges (only when their configuration changed) are restarted, `autodeploy.sh` lists LiveKit's rooms with the server's own key from `~/apps/copilot.env` ([`vps/open-calls.py`](vps/open-calls.py), run in a throwaway container of the agent image). If a room holds anyone but the agent it waits up to `CALL_WAIT_S` (600 s) and then goes on, so a call someone forgot to hang up cannot stop a release. If LiveKit cannot be asked it does not wait. On the Pro, `update.sh` skips its whole update (checkout and speech-server restart) while the site's `GET /api/voice/calls` says a room is open, while the speech server's `/health` reports `inflight` requests, or for `SPEECH_IDLE_S` (20 s) after the last one; launchd runs it again in 5 minutes, and after `CALL_WAIT_S` (600 s) from the first skip it goes on. A site that cannot be reached does not hold it back. The first rollout after this change has no protection on the Pro, because the old speech server and site do not report these counts yet.

**The record.** Each deploy writes a line to `deploy/deploy.log` on the VPS (and to Komodo's log), for example `deploy 3f2a9c1d4e5b: wait=gave-up waited=600s calls_at_start=1 calls_at_end=1 for='swapping the site' agent=started drained=1 restarted='web' took=655s`, and a `deploy` span to Phoenix through Octo (session `deploy-<sha>`, the same session as the voice check's eval span), with `deploy.wait_result` (`none`, `waited`, `gave-up`, `unknown`), `deploy.waited_s`, `deploy.calls_at_start`, `deploy.calls_at_end`. A call that was cut shows up next to the deploy that did it. The Pro writes its decisions to `~/Library/Logs/copilot/update.log` (`deferred, waited ...`, `still busy after ...`, `calls ended after waiting ...`).

Limits: the wait ceiling (600 s) plus the build must fit in Komodo's pre-deploy timeout; if Komodo cuts the script earlier, lower `CALL_WAIT_S`. The first deploy after this change replaces the old fixed-name `copilot-agent` container: it is drained like any other, but Komodo's own `compose up` may remove it as an orphan of the stack, once.

Tests: `npm test` runs [`tests/deploy-keeps-calls.test.ts`](../demo/live-site/tests/deploy-keeps-calls.test.ts) (the scripts with a stand-in for `docker`, and `update.sh` in a scratch git repository). `npm --prefix demo/live-site run test:deploy-sequence` runs the whole sequence on a scratch Docker project with a real call: it deploys, starts a call with audio from macOS `say`, deploys again, and checks the call is still heard, the old agent drains and exits, and the next call goes to the new container. On the live site, `node --no-warnings tests/voice-hold.ts` (in `demo/live-site`) holds one call open and talks every 30 s, so a deploy that lands during it shows in its output whether the call survived.

## Where each part runs

| Part | Machine | How it's reached |
|---|---|---|
| Site and `/api` (`server.ts`) | VPS, `copilot-web` | Cloudflare tunnel A → `copilot-web:8787` |
| LiveKit signalling | VPS, `copilot-livekit:7880` | through `server.ts` at `/rtc` |
| Call audio (WebRTC) | VPS, `copilot-livekit` | the VPS's public address, TCP 7881 and UDP 7882 |
| Voice agent (`speech/agent.py`) | VPS, `copilot-agent-<sha>` (one per release; the old one drains) | joins every call's room |
| Speech models, all five stacks (`speech/server.py`) | Pro, `com.pukujan.copilot-speech` | reverse tunnel → VPS `127.0.0.1:18799` |
| LFM3-Audio (the `lfm3-audio` stack) | Pro, started by the speech server | reverse tunnel → VPS `127.0.0.1:18798` |
| LFM3 text model | Pro, `com.pukujan.lfm3` | nyc-map-agent's tunnel and bridge → `18099` |

The speech models stay on the Pro because Whisper (mlx-whisper) and LFM3-Audio's llama.cpp build run on Apple's GPU, where the voice matrix tested them (#82). Only the stack a call uses is loaded (decision 0014). If the Pro is asleep, voice calls fail, but text chat still works.

## Keys

The containers read `~/apps/copilot.env` on the VPS (mode 600, never in git):

| Name | From |
|---|---|
| `OPENROUTER_JEV_KEY` | `openrouter_jev_only` in `~/Documents/projects/.env` |
| `OCTO_KEY`, `OCTO_WORKSPACE` | `octo_db_chatbots`, `octo_db_chatbots_workspace` |
| `SIGNING_SECRET` | random, made on the VPS |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_KEYS` | random, made on the VPS; `LIVEKIT_KEYS` is `key: secret` |

## Model slots (development only)

[Decision 0017](../docs/decisions/0017-smart-model-slots-for-development.md): LFM3 on the Pro is the default of every task, and a smart hosted model is an opt-in for development. [`demo/live-site/model-slots.json`](../demo/live-site/model-slots.json) names, per slot, a provider and a model. The server validates it when it starts and stops with a message naming the slot if something is wrong. The shipped file names `local` for every slot, which changes nothing.

| Slot | What it decides |
|---|---|
| `desk` | tool and form decisions (the smart model is asked only on a hard turn) |
| `reply` | the spoken reply |
| `rewrite` | question rewrite and clarifying questions |
| `judge2` | a second opinion only where Jev is tied |
| `eval` | test generation and simulated callers (offline) |

| Provider | Model | Key name (env) | Reached at |
|---|---|---|---|
| `local` | LFM3 | none | `LLAMA_URL` / `DESK_URL` |
| `inferhub` | a DeepSeek or Qwen route named as InferHub names it, for example `cb/deepseek-v4.1-flash`, `ocg/qwen3.8-flash`, `ali/qwen3.8-max`, `ali/deepseek-v4-pro-0813` | `INFERHUB_API_KEY` | InferHub (`INFERHUB_URL` overrides) |
| `litellm` | a LiteLLM gateway's `ih/...` names; generic and unused today (the shared VPS gateway has no keys) | `LITELLM_COPILOT_KEY` | `LITELLM_URL` |
| `openrouter-free` | a named model ending in `:free` | `OPENROUTER_FREE_KEY` | OpenRouter |
| `workbuddy` | WorkBuddy's DeepSeek and Qwen models | `WORKBUDDY_KEY` | the Octo vault proxy (`WORKBUDDY_URL` overrides) |

Env overrides, validated by the same rules: `SLOT_<NAME>_PROVIDER`, `SLOT_<NAME>_MODEL`, `SLOT_<NAME>_TIMEOUT_MS` (500 to 60000, default 8000) and `SLOT_<NAME>_DAILY_CAP` (default `SMART_DAILY_CAP`, or 300). For example `SLOT_DESK_PROVIDER=litellm SLOT_DESK_MODEL=ih/ali/deepseek-v4.1-flash`. Switching a slot's provider by env does not carry the file's model over.

The allow-list rejects any model name containing `claude`, `gemma` or `openrouter/free`, whatever the provider. `openrouter-free` needs a `:free` model, `inferhub` takes only DeepSeek or Qwen routes, and `litellm` needs an `ih/` name, so a gateway alias such as `sonnet` is not used. Not every InferHub route serves: on 2026-11-02 `ali/deepseek-v4.1-flash` and `ali/qwen3.8-flash` answered 402 `no_provider_under_bid` while the four routes in the table answered; check a route with a short request before pointing a slot at it. InferHub has no per-key budget here: the limits are `SMART_DAILY_CAP`, the slot's timeout, and any budget set in InferHub's dashboard.

### Smart desk turns (development only)

With the `desk` slot on a hosted model, the page's desk asks it only for a hard turn: the local model's answer was rejected by code (a field that does not exist, a value that fails its check), or it did nothing when the caller said something. Every other turn, and every turn of an ordinary visitor, stays on LFM3.

| Setting | What it does |
|---|---|
| `DESK_HYBRID=1` | the master switch; without it no request ever goes to a hosted model |
| `DESK_KEY` | bearer key for the local model's server, when it needs one |
| `SMART_DAILY_CAP` / `SLOT_DESK_DAILY_CAP` | smart calls per UTC day (default 300); past it the page keeps the local answer |
| `SLOT_DESK_TIMEOUT_MS` | how long the hosted model gets (default 8000); past it the local answer stands |
| `SMART_DEV_HOSTS` | extra host names counted as development hosts (the built-in ones are `localhost`, `127.0.0.1`, `::1`, `*.localhost`, `*.test`) |
| `SMART_OWNER=1`, `OWNER_TOKEN` | the owner switch: a request carrying the token in the `x-owner-token` header or the `copilot_owner` cookie is in scope |

A request is in scope only from a development host (the server passes the request's host name on only when nothing proxied it, so on the VPS it never is one) or with the owner's token. The owner signs in once per browser: `curl -X POST https://copilot.design-bakery.com/api/owner -H 'content-type: application/json' -c jar -d '{"token":"<OWNER_TOKEN>"}'` sets the cookie, or send the same JSON from the page's console with `fetch('/api/owner', {method: 'POST', body: JSON.stringify({token})})`; posting an empty token signs out. Wrong tokens are limited to 10 an hour per visitor. If a gateway reports back a model whose name contains `claude` or `gemma`, the answer is dropped.

Every `/api/desk` span in Phoenix carries `llm.model_name` (the model that answered), `copilot.slot`, `copilot.provider` and `copilot.scope` (`dev-host`, `owner` or `visitor`); an escalation also has `copilot.escalation` = `smart`, and a refused one `copilot.smart_refused` with the reason (`off`, `scope`, `no-key`, `cap`, or `timeout`, `error`, `banned-model` for a failed call).

## First-time setup (done once, 2026-11-01)

- VPS: `git clone https://github.com/Pukujan-lab/voice-agent-research ~/apps/copilot`, write `~/apps/copilot.env`, then run `deploy/vps/autodeploy.sh` once.
- Pro: clone the repo to `~/apps/copilot` and put the speech models in `demo/live-site/speech/models/` (sources in `speech/requirements.txt`). Then run `deploy/pro/install.sh`.
- Cloudflare: tunnel A gets the public hostname `copilot.design-bakery.com` → `http://copilot-web:8787`.
- Komodo: the `copilot` stack and the `copilot-deploy-on-push` action live in `Pukujan-lab/server-management` (`komodo/resources/stacks-vps.toml`).

## Checking it

- Health: `curl https://copilot.design-bakery.com/api/health`
- VPS logs: `ssh vps 'cd ~/apps/copilot/deploy && docker compose -f docker-compose.vps.yml logs --tail 50; docker logs --tail 50 $(docker ps -q --filter label=copilot.role=agent)'`
- Pro logs: `ssh mac-pro 'tail ~/Library/Logs/copilot/*.log'`
- Agents: `ssh vps 'docker ps -a --filter label=copilot.role=agent'`; deploy decisions: `ssh vps 'tail ~/apps/copilot/deploy/deploy.log'`
- A commit that failed is kept in `deploy/.deploy-failed` and isn't retried. Delete that file to retry it.
