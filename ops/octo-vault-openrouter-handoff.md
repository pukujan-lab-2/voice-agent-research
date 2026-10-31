# Handoff: add two locked OpenRouter keys to the Octo vault

From the chatbots session, 2026-10-30. No secrets in this file.

## What exists now (done and tested)

Two new OpenRouter keys, each locked by an OpenRouter guardrail. The secret values are only in
`~/Documents/projects/.env` on Teresa's Mac, as `openrouter_jev_only` and `openrouter_free_only`.
Never print them, paste them into chat, or commit them.

| Key | Guardrail | Allowed | Budget | Tested |
|---|---|---|---|---|
| `jev-only` | `jev` | `~typesafe/jev-latest`, `typesafe/jev-1.14` | $20/month | Jev works on the decisions endpoint; jev-router, free and paid models refused (404) |
| `free-only` | `free-only` | 5 named `:free` models (no Gemma) | $0.01/month | Nemotron x2 and Laguna work; Gemma, paid, Jev and jev-router refused |

## Hard rule for every agent

Never use `openrouter/free` (OpenRouter's free auto-router) or any other router model. The
guardrail cannot block `openrouter/free`, so this rule is the lock. Always pass one exact free model
name from the list below. If that model is busy, pick another name from the list yourself. Never
let OpenRouter choose.

## The task

Add both keys to the vault as `token` items, with the labels and descriptions below, so agents
know what each key is for.

Octo's `POST /api/vault/items` needs a human session with password and MFA (`confirmGate`:
"API keys can never confirm"). So Teresa adds them in the vault UI, or confirms the request
herself. Do not get around the gate (no direct DB inserts, no relaxing the policy).

Then grant the chatbots agent access to both items.

## Item 1

- **Label:** `openrouter-jev`
- **Kind:** token
- **URL:** `https://openrouter.ai/api/alpha/decisions`
- **Secret:** value of `openrouter_jev_only` in the Mac `.env`
- **Description:**

> OpenRouter key locked to the Jev decisions model only (guardrail "jev", $20/month cap). Use it
> for decisions, not chat. Send POST https://openrouter.ai/api/alpha/decisions with model
> "typesafe/jev-1.14" or "~typesafe/jev-latest". The body is {model, state:{...any facts...},
> questions:{<name>:{type:"choice", criteria:{<option_id>:"<what it means>"}, instructions:"..."}}}.
> The reply is answers.<name>.{choice, probabilities, confidence} plus usage.cost (about $0.000014
> per call, about 0.3 s). /chat/completions returns 400 for this model. Every other model,
> including typesafe/jev-router, is refused by the guardrail (404).

## Item 2

- **Label:** `openrouter-free`
- **Kind:** token
- **URL:** `https://openrouter.ai/api/v1/chat/completions`
- **Secret:** value of `openrouter_free_only` in the Mac `.env`
- **Description:**

> RULE: never use "openrouter/free" or any auto-router. Always type one exact model name from this list.
> If it fails, pick another name from the list yourself.
> OpenRouter key locked to 5 named free models (guardrail "free-only", $0.01/month cap). Send POST
> https://openrouter.ai/api/v1/chat/completions with one of:
> nvidia/nemotron-3.5-super-vl:free (vision, JSON), nvidia/nemotron-3-ultra-550b-a55b:free (largest),
> and poolside/laguna-s-2.1:free (coding). Google Gemma models are not allowed.
> thinkingmachines/inkling:free and inkling-small:free work only inside agent apps listed on
> openrouter.ai/apps; direct API calls get 403.
> Paid models are refused. Free providers may log prompts, so never send customer or personal data.
> Expect daily rate limits.

## Done when

Both items are in the vault with these descriptions, the chatbots agent has access, and one call
per key through `/api/vault/proxy/...` works: Jev decisions for `openrouter-jev`, and Laguna chat
for `openrouter-free`.
