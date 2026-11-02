# Deploying the copilot lab

A merge to `main` goes live by itself: when CI passes, `.github/workflows/promote.yml` moves `production` to that commit and the lab deploys ([decision 0016](../docs/decisions/0016-merges-go-live.md), which replaces 0015). You can still move `production` by hand with `git push origin main:production`, for example to roll back one commit. The site is https://copilot.design-bakery.com.

```mermaid
graph TD
  A[production moves on GitHub] --> B[Komodo action copilot-deploy-on-push]
  A --> P[Pro: update.sh every 5 min]
  B --> C[VPS: deploy/vps/autodeploy.sh]
  C --> D[copilot-web, copilot-agent, LiveKit]
  P --> Q[Pro: speech server restarted]
  Q -->|reverse SSH tunnel| D
```

1. Komodo's `copilot-deploy-on-push` action checks GitHub every 5 minutes. When `production` is ahead of the running `copilot-web` image, it deploys the `copilot` stack.
2. That stack's pre-deploy runs [`vps/autodeploy.sh`](vps/autodeploy.sh). It builds both images tagged with the commit, swaps the containers, and waits for `/api/health`. If the health check fails, it puts the previous images back.
3. On the MacBook Pro, [`pro/update.sh`](pro/update.sh) moves its checkout to `production` within 5 minutes and restarts the speech server.

## Where each part runs

| Part | Machine | How it's reached |
|---|---|---|
| Site and `/api` (`server.ts`) | VPS, `copilot-web` | Cloudflare tunnel A → `copilot-web:8787` |
| LiveKit signalling | VPS, `copilot-livekit:7880` | through `server.ts` at `/rtc` |
| Call audio (WebRTC) | VPS, `copilot-livekit` | the VPS's public address, TCP 7881 and UDP 7882 |
| Voice agent (`speech/agent.py`) | VPS, `copilot-agent` | joins every call's room |
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
| `litellm` | the gateway's `ih/...` names, for example `ih/ali/deepseek-v4.1-flash`, `ih/ali/qwen3.8-flash` | `LITELLM_COPILOT_KEY` | `LITELLM_URL` |
| `openrouter-free` | a named model ending in `:free` | `OPENROUTER_FREE_KEY` | OpenRouter |
| `workbuddy` | WorkBuddy's DeepSeek and Qwen models | `WORKBUDDY_KEY` | the Octo vault proxy (`WORKBUDDY_URL` overrides) |

Env overrides, validated by the same rules: `SLOT_<NAME>_PROVIDER`, `SLOT_<NAME>_MODEL`, `SLOT_<NAME>_TIMEOUT_MS` (500 to 60000, default 8000) and `SLOT_<NAME>_DAILY_CAP` (default `SMART_DAILY_CAP`, or 300). For example `SLOT_DESK_PROVIDER=litellm SLOT_DESK_MODEL=ih/ali/deepseek-v4.1-flash`. Switching a slot's provider by env does not carry the file's model over.

The allow-list rejects any model name containing `claude`, `gemma` or `openrouter/free`, whatever the provider. `openrouter-free` needs a `:free` model and `litellm` needs an `ih/` name, so a gateway alias such as `sonnet` is not used.

## First-time setup (done once, 2026-11-01)

- VPS: `git clone https://github.com/Pukujan-lab/voice-agent-research ~/apps/copilot`, write `~/apps/copilot.env`, then run `deploy/vps/autodeploy.sh` once.
- Pro: clone the repo to `~/apps/copilot` and put the speech models in `demo/live-site/speech/models/` (sources in `speech/requirements.txt`). Then run `deploy/pro/install.sh`.
- Cloudflare: tunnel A gets the public hostname `copilot.design-bakery.com` → `http://copilot-web:8787`.
- Komodo: the `copilot` stack and the `copilot-deploy-on-push` action live in `Pukujan-lab/server-management` (`komodo/resources/stacks-vps.toml`).

## Checking it

- Health: `curl https://copilot.design-bakery.com/api/health`
- VPS logs: `ssh vps 'cd ~/apps/copilot/deploy && docker compose -f docker-compose.vps.yml logs --tail 50'`
- Pro logs: `ssh mac-pro 'tail ~/Library/Logs/copilot/*.log'`
- A commit that failed is kept in `deploy/.deploy-failed` and isn't retried. Delete that file to retry it.
