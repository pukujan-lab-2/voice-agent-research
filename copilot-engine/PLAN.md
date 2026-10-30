# Copilot engine: build plan

Goal: make the copilot from the demo video real. A voice or chat guide that walks a person through a
website step by step, asks before it acts, and keeps the business's customer data in house.

## Design: one engine, two adapters

```
person (voice/chat) -> ENGINE -> adapter -> a website
```

**Engine** (the part that must be right, and is the same everywhere):
- Works from a **field list** (name, type, required, validation) and a list of allowed **actions**.
- Asks one question at a time, in plain language. Skips what it already knows.
- Reads hard identifiers back (serials, codes, emails) and accepts corrections ("L as in Lima").
- Shows a **confirm card** before any irreversible action. Never submits without a clear yes.
- Declines anything outside the allowed actions ("I can only help with X here").
- Keeps a transcript and an action log (what it filled, what was confirmed, what was sent).

**Site adapter** (the product for business owners): the owner defines actions in a config; the engine
calls the owner's own endpoints. Customer data goes to the owner's systems, not ours.

**Page adapter** (proof of concept on a third-party site): reads a page's form fields from the DOM
(label, type, options, required), builds the field list, and fills them with Playwright as the person
answers. Same engine, no owner config.

## Phases

1. **Engine core, text only (no voice, no browser).** A state machine over a field list. Pure
   functions plus an LLM call for understanding answers. Unit-testable with scripted conversations.
2. **Demo site with a real backend.** Clone the Brookside Pediatrics booking flow as a small real app
   (form, validation, database). Site adapter calls its API. This is the "owner" demo made real.
3. **Page adapter.** Playwright in the Claude Chromium (`~/bin/claude-chrome`): read the form,
   build the field list, fill on confirm. Start on a **practice form we host**, then a hosted job
   application page (Greenhouse/Lever style) using the user's own details from a local profile file.
4. **Voice.** Put ElevenLabs speech in and out on top of the same engine. Last, because the engine
   is the hard part and is easier to test as text.
5. **Re-cut the demo video** with real screen recordings instead of scripted scenes.

## Safety rules (page adapter)

- The person's profile (name, address, work history) lives in a local file, never in the repo.
- Fills every field it is sure of, asks about the rest, and **stops before Submit**. The person
  presses submit, or says a clear yes to a final confirm card.
- Does not solve CAPTCHAs, accept terms for the person, or create accounts or enter passwords.
- Asks, never guesses, on legal and demographic questions (work authorisation, EEO, disability).
- Skips sites that forbid automation in their terms. No LinkedIn.

## Tests (the regression record, like the Flow ledger)

Scripted scenario conversations run against the engine with a fake adapter, each scored pass/fail:
1. Serial read-back, deliberate mishear, correction, re-confirm.
2. Off-scope request is declined, then the task resumes.
3. Person changes an earlier answer mid-flow; only that field changes.
4. Person says "yes" before the confirm card: engine still shows the card.
5. Never submits on silence, "maybe" or "wait".
6. Page adapter on the practice form: every field filled matches the answers, nothing extra.

Log each run to a JSONL ledger (scenario, engine version, prompt version, verdict) so prompt changes
can be compared over time.

## Decisions to make

- **No Claude in the product** (too expensive; Claude is for coding work only). Open-weight models only,
  behind one swappable interface, via a hosted provider first (Qwen, Llama, Mistral, DeepSeek families;
  check current versions and prices). Self-hosting only for the premium tier.
- **Cascade, not omni, by default:** speech-to-text (Whisper) -> small text model -> text-to-speech.
  Reason: a text transcript per turn is needed to validate, log and test. LFM3-Omni-2B (released
  2026-10-27, LFM Open License, tool calling unconfirmed) is tested in the comparison step; read its
  license first.
- **The system is the strength, the model is replaceable:** identifiers validated by regex in code,
  spell-back from a lookup table, structured output (JSON schema or grammar) so the model can only pick
  an allowed action, all state and the submit gate in the engine, cheap rules for easy turns, a bigger
  open model only for messy ones. Each failure becomes a new scenario.
- Language: Node/TypeScript, to share Playwright with the video-studio tools.
- Where it lives: `chatbots/copilot-engine/` in this repo.

## Model comparison step (before choosing)

Run the same scenarios on each candidate (cascade with 2-3 open text models; LFM3-Omni-2B as text brain
and as speech-to-speech). Log pass rate, latency per turn and cost per conversation in the ledger. Keep
the cheapest that passes the read-back and never-submit-without-yes scenarios.

**Decision (user, 2026-10-30): the product model is `typesafe/jev-router` on OpenRouter (paid), used for everything.** Other candidates are no longer compared. The checks below still run once a key exists.

**Jev Router notes:** A router that picks the model per request.
Unverified: which models it routes between, whether the response names the model that answered,
whether it can be limited to an allowlist, real price (compare page says "Free", likely launch pricing),
tool-calling quality. Use only if all three hold: it reports the model used per turn (so the ledger stays
meaningful), it supports an allowlist, and it passes the scenarios. First test: ~20 scripted turns
(serial read-back, off-scope request), check the raw response for a model field, compare cost against a
pinned open model. Needs an OpenRouter key in `~/Documents/projects/.env` (never printed or committed).

## Business model

Agent as a service: widget on the owner's site, we host the engine, flat monthly fee per site with a cap
on conversations/voice minutes. Multi-tenant from day one (per-site config, actions and logs). Premium:
self-hosted for regulated clients.

## Done when

The engine completes the Brookside booking against the real backend by chat, and fills a hosted job
application form up to the submit button from the person's answers, passing all six scenarios.
