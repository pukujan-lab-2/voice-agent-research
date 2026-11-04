# 0021. Each adopter owns a workspace; the factory owns the code and the registry

**Status:** Accepted · **Date:** 2026-11-04

## Decision

The copilot is one factory that many businesses adopt. The build is tracked in [#121](https://github.com/pukujan-lab-2/voice-agent-research/issues/121). Patterns follow the research in Octo `research/multi-tenant-roles-and-data-tiers-2026-11-04.md`.

| The factory (this repository and its hosts) owns | Each adopting business owns |
|---|---|
| The engine, the widget and SDK, the voice agent | Its own Octo workspace and everything stored in it |
| Model hosting, the models and voice stacks on offer, the lanes | Which models and voice stacks it allows, and its default ([0012](0012-swappable-voice-stacks.md)) |
| Default flows and prompts, as templates | Its own flows, prompts, risk scores ([0011](0011-model-leads-risk-sets-confirmation.md)) and declared lookups ([0018](0018-huge-sites-search-prose-declared-lookups-records.md)) |
| The improvement loop's machinery: rule types, runner, CI, the shared Phoenix behind Octo | Its traces, flagged turns, replay cases, datasets and prompt versions |
| A registry of businesses: business id → workspace, allowed domains, site key, plan | Its passages, files, customer memory, retention, and its staff |
| Engine fixes, which every adopter gets | Its staff dashboard, its failure list, and who may see its raw calls |

What this settles:

1. **One workspace per outside adopter, on shared tables (the pool model).** Octo enforces the fence with row-level security under a runtime role that is not a superuser, the workspace set per transaction. A dedicated database is a later paid tier, same code and config. The factory's own demo businesses may keep sharing the "Chatbots factory" workspace by prefix.
2. **Code flows out; data never flows across.** One business's calls, cases or memory are never read for another. Using a business's data to improve the product for everyone needs that business's yes in its config.
3. **The raw record is kept in full and encrypted.** Every call is recorded unmasked, as today. Raw transcripts (and audio, once recorded) are encrypted by the app under a per-session key wrapped by the business's own key, and stored in Octo object storage; trace spans carry a pointer, not the text. Destroying a key is how a call, a caller or a business is erased. Each business sets its retention.
4. **Raw calls are opened only by grant.** A business's admin grants a named person access for a purpose and a time limit; every open is logged and visible to the business. An emergency path exists, logged and reviewed.
5. **Improvement uses a separate cleaned copy.** Built from the raw record with personal details replaced by a stable per-business pseudonym and near-duplicates removed; pass/fail on leaks is a plain-code re-scan. Datasets and replay cases are built only from this copy.
6. **Visitors are anonymous by default and scoped to one business.** A visitor becomes verified only by a token signed by the business's own server or a one-time code to contact details on file. Caller ID and typed details never unlock records alone. Guest history merges only when the visitor verifies in that session. Everything stored about a person is keyed by business id and a keyed hash under that business's secret.
7. **The copilot reaches a business's site by one script tag** with a public site key. The server accepts calls, sockets and voice tokens only from that business's registered domains. A business's own subdomain is a later option.
8. **Plans resolve into one policy per session.** The business's plan and the visitor's tier (anonymous, verified, or the business's own subscriber) give one policy: features, limits and which model lane serves the session. Over a limit, the session degrades; it is not cut off mid-call.

## Why

The owner asked what each workspace and adopter should own against the factory, how sharing works, how domains work, how live session data is kept raw and encrypted for authorized help while a cleaned copy improves the system, how visitors without accounts and subscribers are handled, and asked for industry patterns rather than guesses (2026-11-04). The product is already "one script tag, your own documents and forms, a dashboard, multi-tenant from day one" (PROJECT.md). Each point above is the documented industry pattern (AWS and Azure tenancy guidance, Postgres RLS docs, Stripe and Intercom embedding, NIST 800-63B, Slack's key management, GDPR Art. 32), chosen to keep Octo the one store ([0004](0004-octo-single-store.md)) and full recording.

## Consequences

- Creating a workspace per adopter needs an account-wide Octo key.
- Octo work: runtime role and forced RLS (octo-database #10), fencing Phoenix's instance-wide datasets and prompts (#47).
- The per-business config (#28) gains workspace, domains, site key, plan, model and stack allow-lists, retention, data-sharing yes/no, and raw-access grants.
- Returning-customer memory (`copilot-engine/src/memory.ts:87-90`) is re-keyed to business id plus a verified subject under a per-business key.
- New pieces: OpenBao for keys (its backups off the VPS), Presidio with a GLiNER model for the cleaned copy, rate limits per policy, llama.cpp lanes. Billing (Lago) waits until there is something to bill.
- For counsel: whether key destruction meets erasure law, call-recording consent by region, health-data duties for a clinic adopter, and the default for cross-business data use.
