# 0017. LFM3 stays the default; smart model slots are opt-in for development only

**Status:** Accepted · **Date:** 2026-11-01 · Replaces nothing: [0009](0009-lfm3-writes-replies.md) and [0001](0001-open-models-only.md) still hold for production

## Decision

Each task a model does has a named slot: `desk` (tool and form decisions), `reply` (the spoken reply), `rewrite` (question rewrite and clarifying questions), `judge2` (a second opinion only where Jev is tied) and `eval` (test generation and simulated callers). Every slot defaults to `local`, which is LFM3 on our own server. A slot can instead name a smart hosted model, from one of three providers: `litellm` (the VPS gateway, through a budgeted virtual key), `openrouter-free` (named `:free` models only) or `workbuddy` (through the Octo vault proxy).

A smart slot takes effect only in development:

- Only for a request from a development host (localhost, `127.0.0.1`, `*.localhost`, `*.test`, or a host listed in `SMART_DEV_HOSTS`) or one carrying the owner's token. An ordinary visitor of a business never reaches a smart model.
- Only where the local model fails: for `desk`, a turn where code rejected the value or nothing was done when something was said.
- With a per-day call cap and a timeout that falls back to the local model.
- Never a model whose name contains `claude`, `gemma` or `openrouter/free`, checked in the file, in env and in the name a gateway reports back.
- The slot and model used are written on every desk span in Phoenix (`copilot.slot`, `copilot.provider`, `llm.model_name`).

The `eval` slot, and the draft expectations for replay cases, run offline and never touch the product path.

## Why

The owner wants to see what smart hosted models make of the copilot while building it (DeepSeek V4.1 and Qwen 3.8 through the InferHub gateway, OpenRouter's named free models, WorkBuddy), without changing what real callers get. The demo sites are fictional, so no real customer data reaches those services in development; PROJECT.md rule 2 keeps real customers' calls off them, and the scoping above is how that is enforced in code.

## Consequences

- With no slot file entry and no env, production behaves exactly as before; the shipped `demo/live-site/model-slots.json` names `local` for every slot.
- Decision 0009 stands: LFM3 writes replies and makes the per-turn form decision, Jev makes passage-pick decisions. No model comparisons come out of this; the smart slots are there to help build and test, not to pick a winner.
- Decision 0001 stands for the product: a smart slot is an owner's development tool, and Claude and Gemma are rejected by name wherever a model is named.
- The key for `litellm` is `LITELLM_COPILOT_KEY` in `~/apps/copilot.env` on the VPS, with a budget and a model list on the gateway; how to rotate it is in [deploy/README.md](../../deploy/README.md).
