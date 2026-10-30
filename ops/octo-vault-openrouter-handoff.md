# Handoff: add two locked OpenRouter keys to the Octo vault

From the chatbots session, 2026-10-30. No secrets in this file.

## What exists now (done and tested)

Two new OpenRouter keys, each locked by an OpenRouter guardrail. The secret values are only in
`~/Documents/projects/.env` on Teresa's Mac, as `openrouter_jev_only` and `openrouter_free_only`.
Never print them, paste them into chat, or commit them.

| Key | Guardrail | Allowed | Budget | Tested |
|---|---|---|---|---|
| `jev-only` | `jev` | `~typesafe/jev-latest`, `typesafe/jev-1.14` | $20/month | Jev works on the decisions endpoint; jev-router, free and paid models refused (404) |
| `free-only` | `free-only` | 6 named `:free` models | $0.01/month | Nemotron x2 and Laguna work; paid, Jev and jev-router refused |

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

> OpenRouter key locked to 6 named free models (guardrail "free-only", $0.01/month cap). Send POST
> https://openrouter.ai/api/v1/chat/completions and always name the model:
> nvidia/nemotron-3.5-super-vl:free (vision, JSON), nvidia/nemotron-3-ultra-550b-a55b:free (largest),
> poolside/laguna-s-2.1:free (coding), and google/gemma-4-31b-it:free (JSON; often busy, so retry on 429).
> thinkingmachines/inkling:free and inkling-small:free work only inside agent apps listed on
> openrouter.ai/apps; direct API calls get 403. Do not use openrouter/free (it auto-picks).
> Paid models are refused. Free providers may log prompts, so never send customer or personal data.
> Expect daily rate limits.

## Done when

Both items are in the vault with these descriptions, the chatbots agent has access, and one call
per key through `/api/vault/proxy/...` works: Jev decisions for `openrouter-jev`, and Laguna chat
for `openrouter-free`.
